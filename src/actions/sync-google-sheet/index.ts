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
                include: { lists: { include: { cards: true } } }
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

            // Strict V8 Mapping Headers
            const SCENE_IDX = 0;
            const INT_EXT_IDX = 1;
            const LENGTH_IDX = 2;
            const LOC_IDX = 3;
            const TIME_IDX = 4;
            const SET_IDX = 5;
            const VFX_IDX = 6;
            const CHAR_IDX = 7;

            // Sync Logic: for simplicity, we map data but don't delete unused ones yet unless we do a full rewrite.
            let listOrderCounter = Math.max(...board.lists.map(l => l.order), -1) + 1;

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[SCENE_IDX]) continue; // Skip empty rows without a Scene number

                const sceneNum = String(row[SCENE_IDX]).trim();
                const intExt = row[INT_EXT_IDX] ? String(row[INT_EXT_IDX]).trim() : "";
                const length = row[LENGTH_IDX] ? String(row[LENGTH_IDX]).trim() : "";
                
                if (!sceneNum) continue;

                // Construct Title "Sc001 INT. HOSPITAL - 2/8 pgs" from columns, or fallback
                // Let's build a clean string
                let constructedTitle = sceneNum;
                if (intExt) constructedTitle += ` ${intExt}`;
                // User's format implies a location is missing from the title but usually "INT. HOSPITAL - DAY", 
                // but the prompt says 3 objects: Scene, INT/EXT, Length. 
                if (length) constructedTitle += ` - ${length}`;

                // Find or create List
                // Try finding by exact scene match prefix
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
                    // Update Title only if it hasn't been locally overridden
                    await db.list.update({
                        where: { id: targetList.id },
                        data: { title: constructedTitle }
                    });
                }

                // Process the 5 standard cards mapped directly to columns 3-7
                const cardDefs = [
                    { title: "Scene LOCATION", value: row[LOC_IDX] },
                    { title: "TIME", value: row[TIME_IDX] },
                    { title: "SET LOCATION", value: row[SET_IDX] },
                    { title: "VFX", value: row[VFX_IDX] },
                    { title: "CHARACTERS", value: row[CHAR_IDX] },
                ];

                let cardOrderCounter = Math.max(...(targetList.cards || []).map(c => c.order), -1) + 1;

                for (let j = 0; j < cardDefs.length; j++) {
                    const def = cardDefs[j];
                    const cellValue = def.value ? String(def.value).trim() : "";

                    // Check if card with this title exists in this list (case insensitive)
                    const existingCard = targetList.cards?.find(c => c.title.toUpperCase() === def.title.toUpperCase());

                    if (existingCard) {
                        // Crucial V8 Logic: Overwrite ONLY if isSyncedWithSheet == true
                        if (existingCard.isSyncedWithSheet && existingCard.description !== cellValue) {
                            await db.card.update({
                                where: { id: existingCard.id },
                                data: { description: cellValue }
                            });
                        }
                    } else if (cellValue) {
                        // Create new card if it has value
                        const newCard = await db.card.create({
                            data: {
                                listId: targetList!.id,
                                title: def.title,
                                description: cellValue,
                                order: cardOrderCounter++,
                                isSyncedWithSheet: true
                            }
                        });
                        if (targetList!.cards) {
                            targetList!.cards.push(newCard);
                        } else {
                            targetList!.cards = [newCard];
                        }
                    }
                }
            }

            revalidatePath(`/board/${board.id}`);
            return { success: true };
            
        } catch (error: any) {
            console.error("Google Sheets Sync Error:", error);
            return { error: "Failed to sync with Google Sheets. Please ensure the Sheet is 'Viewable by anyone with the link' and the ID is correct." };
        }
    });
