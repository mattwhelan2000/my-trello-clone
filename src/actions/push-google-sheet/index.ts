"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
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
                                        orderBy: { createdAt: 'desc' }
                                    }
                                }
                            } 
                        } 
                    } 
                }
            });

            if (!board) throw new Error("Board not found.");
            if (!board.googleSheetId) throw new Error("No Google Sheet linked.");

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
                    throw new Error("Failed to parse Google Service Account credentials.");
                }
            } else {
                authClient = process.env.GOOGLE_API_KEY;
            }

            const sheets = google.sheets({ version: 'v4', auth: authClient });
            const spreadsheetId = board.googleSheetId;

            // Sanitize board title for tab name: Google Sheets disallows * ? : [ ] \ /
            const tabName = board.title.replace(/[*?:\[\]\\/]/g, '').trim().substring(0, 100) || "Board Export";

            // Determine sheetId and ensure tab exists
            let sheetId: number | null | undefined = null;
            const spreadsheetData = await sheets.spreadsheets.get({ spreadsheetId });
            const existingSheets = spreadsheetData.data.sheets || [];
            const targetSheet = existingSheets.find(s => s.properties?.title === tabName);

            if (!targetSheet) {
                // Create new sheet
                const response = await sheets.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: {
                        requests: [
                            {
                                addSheet: {
                                    properties: {
                                        title: tabName
                                    }
                                }
                            }
                        ]
                    }
                });
                sheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId;
            } else {
                sheetId = targetSheet.properties?.sheetId;
            }

            const sheetHeaders = [
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
            const rows: any[][] = [sheetHeaders];
            
            const headersList = await headers();
            const host = headersList.get("host");
            const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
            const baseUrl = `${protocol}://${host}`;

            // To collect cards/lists we need to reset to true
            const listsToReLink: string[] = [];
            const cardsToReLink: string[] = [];

            for (const list of board.lists) {
                // Ignore the system meta lists
                if (list.title === "CHARACTERS" || list.title === "LOCATIONS") continue;

                const row = new Array(sheetHeaders.length).fill("");
                
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

                // Map cards by keyword first
                const sortedCards = list.cards || [];
                
                // 1. Identify VFX Card (High Priority for 'boards' or 'vfx')
                const vfxCardCandidate = sortedCards.find(c => {
                    const t = c.title.toLowerCase();
                    return t.includes("vfx") || t.includes("boards") || t.includes("visual") || t.includes("storyboard");
                });

                // 2. Identify Location Card (High Priority for 'location' or 'master', but EXCLUDE 'set location')
                const locationCardCandidate = sortedCards.find(c => {
                    const t = c.title.toLowerCase();
                    return (t.includes("location") || t.includes("master") || t.includes("scene head")) && !t.includes("set location");
                });

                // 3. Resolve overlaps and fallbacks
                const locationCard = locationCardCandidate || (sortedCards[0]?.id !== vfxCardCandidate?.id ? sortedCards[0] : (sortedCards[1] || sortedCards[0]));
                const vfxCard = vfxCardCandidate || sortedCards.find(c => (c.attachments?.length || 0) > 0 && c.id !== locationCard?.id) || (sortedCards.length > 3 ? sortedCards[3] : null);

                const timeCard = sortedCards.find(c => {
                    const t = c.title.toLowerCase();
                    return t.includes("time") || t.includes("day") || t.includes("night");
                }) || (sortedCards.length > 1 ? sortedCards[1] : null);

                const setLocationCard = sortedCards.find(c => {
                    const t = c.title.toLowerCase();
                    return t.includes("set location") || t.includes("address");
                }) || (sortedCards.length > 2 ? sortedCards[2] : null);

                const charactersCard = sortedCards.find(c => {
                    const t = c.title.toLowerCase();
                    return t.includes("character") || t.includes("char") || t.includes("cast");
                }) || (sortedCards.length > 4 ? sortedCards[4] : null);

                // SCENE LOCATION & DESCRIPTION (from location card)
                if (locationCard) {
                    row[3] = locationCard.title;
                    row[4] = locationCard.description || "";
                    const img = locationCard.attachments.find(a => a.isCover) || locationCard.attachments.find(a => a.type === "IMAGE");
                    if (img) {
                        const proxyUrl = `${baseUrl}/api/proxy-image?url=${encodeURIComponent(img.url)}`;
                        row[5] = `=IMAGE("${proxyUrl}")`;
                    }
                }

                // TIME
                if (timeCard) row[6] = timeCard.title;

                // SET LOCATION
                if (setLocationCard) {
                    // Try to find a link (Google Maps etc) in attachments
                    const mapLink = setLocationCard.attachments.find(a => a.type === "LINK") || 
                                   setLocationCard.attachments.find(a => a.url.includes("google.com/maps") || a.url.includes("goo.gl/maps"));
                    
                    if (mapLink) {
                        const label = setLocationCard.description?.slice(0, 50) || "Google Maps";
                        row[7] = `=HYPERLINK("${mapLink.url}", "${label}")`;
                    } else {
                        row[7] = setLocationCard.description || setLocationCard.title || "";
                    }
                }

                // VFX & VFX THUMBNAIL (from vfx card)
                if (vfxCard) {
                    row[8] = vfxCard.description || "";
                    const img = vfxCard.attachments.find(a => a.isCover) || vfxCard.attachments.find(a => a.type === "IMAGE");
                    if (img) {
                        const proxyUrl = `${baseUrl}/api/proxy-image?url=${encodeURIComponent(img.url)}`;
                        row[9] = `=IMAGE("${proxyUrl}")`;
                    }
                }

                // CHARACTERS
                if (charactersCard) row[10] = charactersCard.description || "";

                for (const card of sortedCards) {
                    if (!card.isSyncedWithSheet) cardsToReLink.push(card.id);
                }

                rows.push(row);
            }

            // Write Everything
            await sheets.spreadsheets.values.clear({ spreadsheetId, range: `'${tabName}'!A:ZZ` }).catch(() => {});
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `'${tabName}'!A1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: rows }
            });

            // Apply formatting: blue header, thick border, freeze row 1
            if (sheetId !== null && sheetId !== undefined) {
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
            }

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
                 throw new Error("Permission denied. Ensure the service account email is added as an 'Editor'.");
            }
            throw new Error("Failed to push to Google Sheet. Check server logs.");
        }
    });
