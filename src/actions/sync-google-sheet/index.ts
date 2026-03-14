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

            // Simple MVP Mapping:
            // Find columns:
            // "SCENES" -> List Title
            // "Description" -> Description Card
            // "Location" -> Location Card Text (or list mapping)
            // Let's assume Row 1 (index 0) is headers
            const headers: string[] = rows[0].map(h => String(h).toUpperCase().trim());
            const sceneIdx = headers.findIndex(h => h.includes("SCENE") || h === "SCENES" || h === "SC");
            
            if (sceneIdx === -1) {
                return { error: "Could not find a 'SCENES' column in the first row to act as List titles." };
            }

            // Sync Logic: for simplicity, we map data but don't delete unused ones yet unless we do a full rewrite.
            // Let's do a non-destructive insert/update.
            // For each row, check if a list matching the scene number exists. If not, create it.
            let listOrderCounter = Math.max(...board.lists.map(l => l.order), -1) + 1;

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row[sceneIdx]) continue; // Skip empty rows

                const sceneName = String(row[sceneIdx]).trim();
                if (!sceneName) continue;

                // Find or create List
                let targetList = board.lists.find(l => l.title.includes(sceneName) || l.title === sceneName);
                
                if (!targetList) {
                    targetList = await db.list.create({
                        data: {
                            boardId: board.id,
                            title: sceneName,
                            order: listOrderCounter++
                        },
                        include: { cards: true }
                    });
                    board.lists.push(targetList);
                }

                // Process other columns into Cards
                let cardOrderCounter = Math.max(...(targetList.cards || []).map(c => c.order), -1) + 1;

                for (let j = 0; j < headers.length; j++) {
                    if (j === sceneIdx) continue;
                    const colName = headers[j];
                    const cellValue = row[j] ? String(row[j]).trim() : "";

                    if (!cellValue) continue;

                    // Check if card with this column name exists in this list
                    const existingCard = targetList.cards?.find(c => c.title.toLowerCase() === colName.toLowerCase());

                    if (existingCard) {
                        // Update existing card description with sheet value
                        await db.card.update({
                            where: { id: existingCard.id },
                            data: { description: cellValue }
                        });
                    } else {
                        // Create new card
                        const newCard = await db.card.create({
                            data: {
                                listId: targetList.id,
                                title: colName,
                                description: cellValue,
                                order: cardOrderCounter++
                            }
                        });
                        if (targetList.cards) {
                            targetList.cards.push(newCard);
                        } else {
                            targetList.cards = [newCard];
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
