"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { PushGoogleSheetSchema } from "./schema";
import { google } from "googleapis";

export const pushGoogleSheet = actionClient
    .schema(PushGoogleSheetSchema)
    .action(async ({ parsedInput: { boardId } }) => {
        try {
            const board = await db.board.findUnique({
                where: { id: boardId },
                include: { 
                    lists: { 
                        orderBy: { order: 'asc' },
                        include: { 
                            cards: { 
                                orderBy: { order: 'asc' },
                                include: {
                                    attachments: {
                                        where: { isCover: true }
                                    }
                                }
                            } 
                        } 
                    } 
                }
            });

            if (!board) return { error: "Board not found." };
            if (!board.googleSheetId) return { error: "No Google Sheet linked." };

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
                        scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Write access required
                    });
                } catch (err) {
                    return { error: "Failed to parse Google Service Account credentials." };
                }
            } else {
                authClient = process.env.GOOGLE_API_KEY;
            }

            const sheets = google.sheets({ version: 'v4', auth: authClient });
            const spreadsheetId = board.googleSheetId;

            const headers = [
                "SCENE",
                "INT/EXT",
                "LENGTH",
                "Scene LOCATION",
                "Scene DESCRIPTION",
                "THUMBNAIL",
                "TIME",
                "SET LOCATION",
                "VFX",
                "VFX THUMBNAIL",
                "CHARACTERS"
            ];

            // Build Rows. 
            // We'll rewrite the entire sheet for simplicity of architecture, 
            // taking everything that currently exists in the DB to form the sheet.
            const rows: any[][] = [headers];
            
            // To collect cards/lists we need to reset to true
            const listsToReLink: string[] = [];
            const cardsToReLink: string[] = [];

            for (const list of board.lists) {
                // Ignore the system meta lists
                if (list.title === "CHARACTERS" || list.title === "LOCATIONS") continue;

                const row = new Array(headers.length).fill("");
                
                // Parse List Title: "Sc001 INT. HOSPITAL - 2/8 pgs" -> [Sc001, INT., 2/8 pgs]
                // Fallback mechanics if it's not strictly formatted
                const parts = list.title.split(/ - | /); 
                
                row[0] = parts[0] || list.title; // SCENE
                
                // Extremely basic parsing for INT/EXT
                const upperTitle = list.title.toUpperCase();
                if (upperTitle.includes("INT/EXT") || upperTitle.includes("INT. / EXT.")) row[1] = "INT/EXT";
                else if (upperTitle.includes("INT")) row[1] = "INT.";
                else if (upperTitle.includes("EXT")) row[1] = "EXT.";

                // Length parsing (look for "pgs" or "p.")
                const pgsMatch = list.title.match(/((?:\d+\s*\+\s*)?\d+\/\d+|\d+)\s*(pgs|pages|p\.)/i);
                if (pgsMatch) row[2] = pgsMatch[0];

                // If the list itself was unsynced (title changed locally), track it to relink
                if (!list.isSyncedWithSheet) listsToReLink.push(list.id);

                // Map specific cards by Order
                const sortedCards = list.cards || [];
                
                if (sortedCards[0]) {
                    row[3] = sortedCards[0].title;
                    row[4] = sortedCards[0].description || "";
                    if (sortedCards[0].attachments && sortedCards[0].attachments.length > 0) {
                        row[5] = `=IMAGE("${sortedCards[0].attachments[0].url}")`;
                    }
                }
                if (sortedCards[1]) row[6] = sortedCards[1].title; // Time Title
                if (sortedCards[2]) row[7] = sortedCards[2].description || "";
                if (sortedCards[3]) {
                    row[8] = sortedCards[3].description || "";
                    if (sortedCards[3].attachments && sortedCards[3].attachments.length > 0) {
                        row[9] = `=IMAGE("${sortedCards[3].attachments[0].url}")`;
                    }
                }
                if (sortedCards[4]) row[10] = sortedCards[4].description || "";

                for (const card of sortedCards) {
                    if (!card.isSyncedWithSheet) cardsToReLink.push(card.id);
                }

                rows.push(row);
            }

            // Write Everything
            await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'A:ZZ' }).catch(() => {});
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: 'A1',
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: rows }
            });

            // Get sheet ID to apply formatting
            const spreadsheetData = await sheets.spreadsheets.get({ spreadsheetId });
            const sheetId = spreadsheetData.data.sheets?.[0]?.properties?.sheetId || 0;

            // Apply formatting: blue header, thick border, freeze row 1
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            updateSheetProperties: {
                                properties: {
                                    sheetId: sheetId,
                                    gridProperties: { frozenRowCount: 1 }
                                },
                                fields: "gridProperties.frozenRowCount"
                            }
                        },
                        {
                            repeatCell: {
                                range: {
                                    sheetId: sheetId,
                                    startRowIndex: 0,
                                    endRowIndex: 1
                                },
                                cell: {
                                    userEnteredFormat: {
                                        backgroundColor: { red: 0.1, green: 0.3, blue: 0.6 },
                                        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                                        borders: {
                                            top: { style: "SOLID_THICK" },
                                            bottom: { style: "SOLID_THICK" },
                                            left: { style: "SOLID_THICK" },
                                            right: { style: "SOLID_THICK" }
                                        }
                                    }
                                },
                                fields: "userEnteredFormat(backgroundColor,textFormat,borders)"
                            }
                        }
                    ]
                }
            });

            // Re-establish Links in the Database!
            if (listsToReLink.length > 0) {
                await db.list.updateMany({
                    where: { id: { in: listsToReLink } },
                    data: { isSyncedWithSheet: true }
                });
            }
            if (cardsToReLink.length > 0) {
                await db.card.updateMany({
                    where: { id: { in: cardsToReLink } },
                    data: { isSyncedWithSheet: true }
                });
            }

            return { success: true };
            
        } catch (error: any) {
            console.error("Google Sheets Push Error:", error);
            if (error?.message?.includes('permission')) {
                 return { error: "Permission denied. Ensure the service account email is added as an 'Editor'." };
            }
            return { error: "Failed to push to Google Sheet. Check server logs." };
        }
    });
