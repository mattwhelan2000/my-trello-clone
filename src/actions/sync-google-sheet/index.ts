"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { SyncGoogleSheetSchema } from "./schema";
import { google } from "googleapis";

export const syncGoogleSheet = actionClient
    .schema(SyncGoogleSheetSchema)
    .action(async ({ parsedInput: { boardId, analyze, tabName: passedTabName, globalColor, globalLabel, globalLabelColor, skipZeroVfx, disabledCards = [], syncSceneLocation = true, syncTime = true, syncSetLocation = true, syncCharacters = true, syncVfx = true } }) => {
        try {
            const board = await db.board.findUnique({
                where: { id: boardId },
                include: { 
                    lists: { 
                        orderBy: { order: 'asc' },
                        include: { 
                            cards: { orderBy: { order: 'asc' } } 
                        } 
                    } 
                }
            });

            if (!board) {
                throw new Error("Board not found.");
            }

            if (!board.googleSheetId) {
                throw new Error("No Google Sheet linked to this board. Please link a Sheet ID in the Board Settings.");
            }

            if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_API_KEY) {
                throw new Error("Server is missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_API_KEY environment variables.");
            }

            let authClient: any;
            
            if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
                try {
                    let credentials;
                    try {
                        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
                    } catch {
                        credentials = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf-8'));
                    }

                    authClient = new google.auth.GoogleAuth({
                        credentials,
                        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
                    });
                } catch (err) {
                    console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON", err);
                    throw new Error("Failed to parse Google Service Account credentials.");
                }
            } else {
                authClient = process.env.GOOGLE_API_KEY;
            }

            const sheets = google.sheets({ version: 'v4', auth: authClient });

            // Determine Tab Name
            const tabName = passedTabName || board.title.replace(/[*?:\[\]\\/]/g, '').trim().substring(0, 100) || "Board Export";

            let rows: any[] = [];
            try {
                const response = await sheets.spreadsheets.values.get({
                    spreadsheetId: board.googleSheetId,
                    range: `'${tabName}'!A:Z`,
                });
                rows = response.data.values || [];
            } catch (err) {
                console.log(`Tab '${tabName}' not found. Falling back to default A:Z range.`);
                const fallbackResponse = await sheets.spreadsheets.values.get({
                    spreadsheetId: board.googleSheetId,
                    range: 'A:Z', 
                });
                rows = fallbackResponse.data.values || [];
            }

            if (!rows || rows.length === 0) {
                throw new Error("No data found in the linked Google Sheet.");
            }

            // V9 Mapping Headers (15 Columns)
            // 0: SCENE, 1: INT/EXT, 2: LENGTH, 3: Scene LOCATION, 4: Scene DESCRIPTION, 5: THUMBNAIL, 6: TIME
            // 7: SET LOCATION, 8: VFX, 9: SHOT COUNT, 10: DIFFICULTY, 11: VFX ASSETS (Asset Numbers), 12: VFX THUMBNAIL, 13: CHARACTERS, 14: PER SHOT COST
            const SCENE_IDX = 0;
            const INT_EXT_IDX = 1;
            const LENGTH_IDX = 2;
            const LOC_TITLE_IDX = 3;
            const LOC_DESC_IDX = 4;
            const TIME_IDX = 6;
            const SET_IDX = 7;
            const VFX_IDX = 8;
            const SHOT_COUNT_IDX = 9;
            const DIFFICULTY_IDX = 10;
            const ASSETS_IDX = 11;
            const CHAR_IDX = 13;

            // Group rows by Scene
            const sceneGroups: Record<string, any[]> = {};
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[SCENE_IDX]) continue;
                const sceneNum = String(row[SCENE_IDX]).trim();
                if (!sceneGroups[sceneNum]) sceneGroups[sceneNum] = [];
                sceneGroups[sceneNum].push(row);
            }

            const analysisSummary: any[] = [];
            let listOrderCounter = Math.max(...board.lists.map(l => l.order), -1) + 1;

            // Before making any changes, save a full sync backup
            if (!analyze) {
                const allLists = await db.list.findMany({ where: { boardId } });
                const allCards = await db.card.findMany({ where: { list: { boardId } } });
                const allLabels = await db.label.findMany({ where: { card: { list: { boardId } } } });

                await db.boardSnapshot.create({
                    data: {
                        boardId,
                        title: `SYNC_BACKUP_${Date.now()}`,
                        data: { lists: allLists, cards: allCards, labels: allLabels }
                    }
                });
            }

            for (const [sceneNum, groupRows] of Object.entries(sceneGroups)) {
                const firstRow = groupRows[0];
                const intExt = firstRow[INT_EXT_IDX] ? String(firstRow[INT_EXT_IDX]).trim() : "";
                const length = firstRow[LENGTH_IDX] ? String(firstRow[LENGTH_IDX]).trim() : "";
                
                let constructedTitle = sceneNum;
                if (intExt) constructedTitle += ` ${intExt}`;
                if (length) constructedTitle += ` - ${length}`;

                // Scene Metadata
                const locTitle = firstRow[LOC_TITLE_IDX] ? String(firstRow[LOC_TITLE_IDX]).trim() : "Scene LOCATION";
                const locDesc = firstRow[LOC_DESC_IDX] ? String(firstRow[LOC_DESC_IDX]).trim() : "";
                const timeTitle = firstRow[TIME_IDX] ? String(firstRow[TIME_IDX]).trim() : "TIME";
                const setDesc = firstRow[SET_IDX] ? String(firstRow[SET_IDX]).trim() : "";
                const charDesc = firstRow[CHAR_IDX] ? String(firstRow[CHAR_IDX]).trim() : "";

                // Analysis of List
                let targetList = board.lists.find(l => l.title.startsWith(sceneNum));
                const listAction = !targetList ? "CREATE" : (targetList.title !== constructedTitle ? "UPDATE" : "NONE");
                
                if (analyze) {
                    const sceneChanges = {
                        sceneNum,
                        listAction,
                        newTitle: constructedTitle,
                        standardCards: [
                            { title: "Scene LOCATION", action: "SYNC", detail: locTitle },
                            { title: "TIME", action: "SYNC", detail: timeTitle },
                            { title: "SET LOCATION", action: "SYNC", detail: setDesc },
                            { title: "CHARACTERS", action: "SYNC", detail: charDesc },
                        ],
                        vfxCards: groupRows.filter(r => {
                            if (!r[VFX_IDX]) return false;
                            if (skipZeroVfx && (!r[SHOT_COUNT_IDX] || String(r[SHOT_COUNT_IDX]).trim() === "0")) return false;
                            return true;
                        }).map(r => ({
                            title: String(r[VFX_IDX]).trim(),
                            shotCount: r[SHOT_COUNT_IDX] ? String(r[SHOT_COUNT_IDX]).trim() : "",
                            assets: r[ASSETS_IDX] ? String(r[ASSETS_IDX]).trim() : "",
                            action: "SYNC"
                        }))
                    };
                    analysisSummary.push(sceneChanges);
                    continue;
                }

                // EXECUTION MODE
                if (!targetList) {
                    targetList = await db.list.create({
                        data: {
                            boardId: board.id,
                            title: constructedTitle,
                            order: listOrderCounter++,
                            isSyncedWithSheet: true
                        },
                        include: { cards: true }
                    });
                } else if (targetList.title !== constructedTitle) {
                    await db.list.update({
                        where: { id: targetList.id },
                        data: { title: constructedTitle }
                    });
                }

                const sortedCards = (targetList.cards || []).sort((a, b) => a.order - b.order);
                let cardOrderCounter = Math.max(...sortedCards.map(c => c.order), -1) + 1;

                const applyCardSync = async (idx: number, defaultTitle: string, newTitle: string | undefined, newDesc: string | undefined, extras?: any) => {
                    const finalTitle = newTitle || defaultTitle;
                    
                    // Skip if disabled by user
                    if (disabledCards.includes(`${sceneNum}|${finalTitle}`)) return;

                    const existing = sortedCards[idx];
                    let data: any = { 
                        title: finalTitle, 
                        description: newDesc || "", 
                        isSyncedWithSheet: true,
                        ...extras 
                    };

                    if (globalColor) {
                        data.color = globalColor;
                    }

                    if (existing) {
                        await db.card.update({ where: { id: existing.id }, data });
                        if (globalLabel && globalLabelColor) {
                            const existingLabel = await db.label.findFirst({ where: { cardId: existing.id, title: globalLabel } });
                            if (!existingLabel) {
                                await db.label.create({ data: { cardId: existing.id, title: globalLabel, color: globalLabelColor } });
                            }
                        }
                    } else {
                        const newCard = await db.card.create({ data: { listId: targetList!.id, order: cardOrderCounter++, ...data } });
                        if (globalLabel && globalLabelColor) {
                            await db.label.create({ data: { cardId: newCard.id, title: globalLabel, color: globalLabelColor } });
                        }
                    }
                };


                // Standard Cards
                if (syncSceneLocation) await applyCardSync(0, "Scene LOCATION", locTitle, locDesc);
                if (syncTime) await applyCardSync(1, "TIME", timeTitle, undefined);
                if (syncSetLocation) await applyCardSync(2, "SET LOCATION", undefined, setDesc);
                if (syncCharacters) await applyCardSync(4, "CHARACTERS", undefined, charDesc);

                // VFX Cards (One per row in group)
                // We start VFX cards at index 5 or overwrite existing VFX cards
                if (syncVfx) {
                    let vfxCounter = 0;
                    for (const row of groupRows) {
                        const vfxTitle = row[VFX_IDX] ? String(row[VFX_IDX]).trim() : null;
                        if (!vfxTitle) continue;

                        const shotCount = row[SHOT_COUNT_IDX] ? String(row[SHOT_COUNT_IDX]).trim() : "";
                        
                        if (skipZeroVfx && (!shotCount || shotCount === "0")) continue;

                        const assets = row[ASSETS_IDX] ? String(row[ASSETS_IDX]).trim() : "";
                        const vfxDesc = `Assets: ${assets}`;

                        // Find existing card by title or by offset
                        const cardIdx = 5 + vfxCounter;
                        await applyCardSync(cardIdx, "VFX", vfxTitle, vfxDesc, { shotCount, vfxAssetNumbers: assets });
                        vfxCounter++;
                    }
                }
            }

            if (analyze) {
                return { analysis: analysisSummary };
            }

            revalidatePath(`/board/${board.id}`);
            return { success: true };
            
        } catch (error: any) {
            console.error("Google Sheets Sync Error:", error);
            throw new Error(error.message || "Failed to sync with Google Sheets.");
        }
    });
