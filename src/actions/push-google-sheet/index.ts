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
                    let credentials;
                    try {
                        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
                    } catch {
                        credentials = JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf-8'));
                    }
                    authClient = new google.auth.GoogleAuth({
                        credentials,
                        scopes: ['https://www.googleapis.com/auth/spreadsheets'], // Need full write access
                    });
                } catch (err) {
                    console.error("Failed to parse Service Account JSON", err);
                    return { error: "Failed to parse Google Service Account credentials." };
                }
            } else {
                authClient = process.env.GOOGLE_API_KEY;
            }

            const sheets = google.sheets({ version: 'v4', auth: authClient });
            const spreadsheetId = board.googleSheetId;

            // 1. Gather all unique card titles across all lists to form columns
            const allCardTitles = new Set<string>();
            for (const list of board.lists) {
                for (const card of list.cards || []) {
                    allCardTitles.add(card.title);
                }
            }

            // Standard headers
            const headers = ["SCENES", ...Array.from(allCardTitles)];

            // 2. Build rows
            const rows: any[][] = [headers];

            for (const list of board.lists) {
                const row = new Array(headers.length).fill("");
                row[0] = list.title; // SCENES column

                for (const card of list.cards || []) {
                    const colIdx = headers.indexOf(card.title);
                    if (colIdx !== -1) {
                        row[colIdx] = card.description || "";
                    }
                }
                rows.push(row);
            }

            // 3. Clear existing values
            await sheets.spreadsheets.values.clear({
                spreadsheetId,
                range: 'A:ZZ',
            }).catch(e => console.log("Clear failed (might be empty already)", e.message));

            // 4. Write new values
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: 'A1',
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: rows
                }
            });

            return { success: true };
            
        } catch (error: any) {
            console.error("Google Sheets Push Error:", error);
            // Check if it's an auth/permissions error
            if (error?.message?.includes('permission')) {
                 return { error: "Permission denied. Ensure the service account email is added as an 'Editor' to the Google Sheet." };
            }
            return { error: "Failed to push to Google Sheet. Check server logs." };
        }
    });
