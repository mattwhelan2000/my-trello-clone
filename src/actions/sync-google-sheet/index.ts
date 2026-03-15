"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { SyncGoogleSheetSchema } from "./schema";
import { google } from "googleapis";

export const syncGoogleSheet = actionClient
    .schema(SyncGoogleSheetSchema)
    .action(async ({ parsedInput: { boardId } }) => {
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
                return { error: "Board not found." };
            }

            if (!board.googleSheetId) {
                return { error: "No Google Sheet linked to this board. Please link a Sheet ID in the Board Settings." };
            }

            if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON && !process.env.GOOGLE_API_KEY) {
                return { error: "Server is missing GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_API_KEY environment variables." };
            }

            let authClient: any;
            
            if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
                try {
                    // Try parsing the JSON string (could be stringified JSON or base64)
                    let credentials;
                    try {
                        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
                    } catch {
                        // If it fails, try decoding from base64 first
                        credentials = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf-8'));
                    }

                    authClient = new google.auth.GoogleAuth({
                        credentials,
                        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
                    });
                } catch (err) {
                    console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON", err);
                    return { error: "Failed to parse Google Service Account credentials. Check your .env file." };
                }
            } else {
                // Fallback to simple API key if provided instead
                authClient = process.env.GOOGLE_API_KEY;
            }

            const sheets = google.sheets({ version: 'v4', auth: authClient });

            // Fetch the sheet data (assumes first sheet/tab)
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: board.googleSheetId,
                range: 'A:Z', // Getting a wide range to capture all necessary columns
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                return { error: "No data found in the linked Google Sheet." };
            }

            // Strict V8 Mapping Headers (9 Columns)
            const SCENE_IDX = 0;
            const INT_EXT_IDX = 1;
            const LENGTH_IDX = 2;
            const LOC_TITLE_IDX = 3;
            const LOC_DESC_IDX = 4;
            const TIME_IDX = 5;
            const SET_IDX = 6;
            const VFX_IDX = 7;
            const CHAR_IDX = 8;

            // Sync Logic
            let listOrderCounter = Math.max(...board.lists.map(l => l.order), -1) + 1;

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[SCENE_IDX]) continue; 

                const sceneNum = String(row[SCENE_IDX]).trim();
                const intExt = row[INT_EXT_IDX] ? String(row[INT_EXT_IDX]).trim() : "";
                const length = row[LENGTH_IDX] ? String(row[LENGTH_IDX]).trim() : "";
                
                if (!sceneNum) continue;

                let constructedTitle = sceneNum;
                if (intExt) constructedTitle += ` ${intExt}`;
                if (length) constructedTitle += ` - ${length}`;

                // Find or create List
                let targetList = board.lists.find(l => l.title.startsWith(sceneNum));
                
                if (!targetList) {
                    const newList = await db.list.create({
                        data: {
                            boardId: board.id,
                            title: constructedTitle,
                            order: listOrderCounter++,
                            isSyncedWithSheet: true
                        },
                        include: { cards: true }
                    });
                    board.lists.push(newList);
                    targetList = newList;
                } else if (targetList.isSyncedWithSheet && targetList.title !== constructedTitle) {
                    await db.list.update({
                        where: { id: targetList.id },
                        data: { title: constructedTitle }
                    });
                }

                // Process the 5 standard cards mapped directly to columns 3-8 by sequential order!
                let sortedCards = (targetList.cards || []).sort((a, b) => a.order - b.order);
                let cardOrderCounter = Math.max(...sortedCards.map(c => c.order), -1) + 1;

                // Helper to update or create
                const applyCardSync = async (
                    cardIdx: number, 
                    defaultTitle: string, 
                    newTitle: string | undefined, 
                    newDesc: string | undefined
                ) => {
                    const existingCard = sortedCards[cardIdx];
                    if (existingCard) {
                        if (existingCard.isSyncedWithSheet) {
                            const dataToUpdate: any = {};
                            if (newTitle !== undefined && existingCard.title !== newTitle) dataToUpdate.title = newTitle;
                            if (newDesc !== undefined && existingCard.description !== newDesc) dataToUpdate.description = newDesc;
                            
                            if (Object.keys(dataToUpdate).length > 0) {
                                await db.card.update({
                                    where: { id: existingCard.id },
                                    data: dataToUpdate
                                });
                            }
                        }
                    } else if (newTitle || newDesc) { // Only create if missing and has data
                        const newC = await db.card.create({
                            data: {
                                listId: targetList!.id,
                                title: newTitle || defaultTitle,
                                description: newDesc || "",
                                order: cardOrderCounter++,
                                isSyncedWithSheet: true
                            }
                        });
                        sortedCards.push(newC);
                    }
                };

                const locTitle = row[LOC_TITLE_IDX] ? String(row[LOC_TITLE_IDX]).trim() : "Scene LOCATION";
                const locDesc = row[LOC_DESC_IDX] ? String(row[LOC_DESC_IDX]).trim() : "";
                const timeTitle = row[TIME_IDX] ? String(row[TIME_IDX]).trim() : "TIME";
                const setDesc = row[SET_IDX] ? String(row[SET_IDX]).trim() : "";
                const vfxDesc = row[VFX_IDX] ? String(row[VFX_IDX]).trim() : "";
                const charDesc = row[CHAR_IDX] ? String(row[CHAR_IDX]).trim() : "";

                // 0: Scene Location (Col 3 = Title, Col 4 = Desc)
                await applyCardSync(0, "Scene LOCATION", locTitle, locDesc);
                // 1: Time (Col 5 = Title)
                await applyCardSync(1, "TIME", timeTitle, undefined);
                // 2: Set Location (Col 6 = Desc)
                await applyCardSync(2, "SET LOCATION", undefined, setDesc);
                // 3: VFX (Col 7 = Desc)
                await applyCardSync(3, "VFX", undefined, vfxDesc);
                // 4: Characters (Col 8 = Desc)
                await applyCardSync(4, "CHARACTERS", undefined, charDesc);
            }

            revalidatePath(`/board/${board.id}`);
            return { success: true };
            
        } catch (error: any) {
            console.error("Google Sheets Sync Error:", error);
            return { error: "Failed to sync with Google Sheets. Please ensure the Sheet is 'Viewable by anyone with the link' and the ID is correct." };
        }
    });
