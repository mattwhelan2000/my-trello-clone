"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { BulkIngestSchema } from "./schema";
import { detectFileType } from "@/lib/file-type-utils";
import { google } from "googleapis";
import { parseFilename, fuzzyMatchList } from "@/lib/import-utils";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

async function listDriveFolder(folderId: string): Promise<{ name: string; url: string; id: string; mimeType: string }[]> {
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_DRIVE_API_KEY is not set.");

    const results: { name: string; url: string; id: string; mimeType: string }[] = [];
    let pageToken: string | undefined;

    do {
        const params = new URLSearchParams({
            q: `'${folderId}' in parents and trashed=false`,
            fields: "nextPageToken,files(id,name,mimeType,thumbnailLink)",
            pageSize: "1000",
            key: apiKey,
        });
        if (pageToken) params.set("pageToken", pageToken);

        const res = await fetch(`${DRIVE_API}/files?${params}`);
        if (!res.ok) throw new Error(`Google Drive API error: ${res.status}`);

        const data = await res.json();
        for (const file of data.files || []) {
            const url = `/api/drive-image?id=${file.id}`;
            results.push({ name: file.name, url, id: file.id, mimeType: file.mimeType });
        }
        pageToken = data.nextPageToken;
    } while (pageToken);

    return results;
}

async function getDriveFileContent(fileId: string): Promise<string> {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");

    const credentials = JSON.parse(serviceAccountJson);
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });
    const response = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "text" }
    );
    return response.data as string;
}

export const bulkIngestImages = actionClient
    .schema(BulkIngestSchema)
    .action(async ({ parsedInput: { boardId, urls, isAnalysis, resolutions, defaultResolution, resolvedFiles, fileOverrides, globalColor, globalLabel, globalLabelColor } }) => {
        try {
            console.log(`[BulkIngest] Start (${boardId})`);

            let allFiles = (resolvedFiles as any[]) || [];
            if (allFiles.length === 0) {
                for (const url of urls) {
                    // Google Drive folder
                    const driveMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                    if (driveMatch) {
                        allFiles.push(...(await listDriveFolder(driveMatch[1])));
                        continue;
                    }
                    // Dropbox folder — files come pre-resolved from the client preview dialog
                    // (Dropbox files passed as resolvedFiles[] already)
                }
            }
            if (allFiles.length === 0) return { count: 0 };

            const existingLists = await db.list.findMany({ where: { boardId } });
            const existingCards = await db.card.findMany({
                where: { listId: { in: existingLists.map(l => l.id) } }
            });
            const cardMap = new Map(existingCards.map(c => [`${c.listId}_${c.title.toLowerCase()}`, c]));

            // Pre-parse files
            const processedFiles = [];
            for (const file of allFiles) {
                let scenePrefix: string | null = null;
                let cardName = "";
                let description = "";

                if (file.mimeType === "application/json" && file.id) {
                    try {
                        const content = await getDriveFileContent(file.id);
                        const json = JSON.parse(content);
                        const rawTitle = json.title || file.name.replace(/\.json$/, "");
                        description = json.description || "";

                        const parsed = parseFilename(rawTitle);
                        scenePrefix = parsed.scenePrefix;
                        cardName = parsed.cardName;
                    } catch (e) {
                        const parsed = parseFilename(file.name);
                        scenePrefix = parsed.scenePrefix;
                        cardName = parsed.cardName;
                    }
                } else {
                    const parsed = parseFilename(file.name);
                    scenePrefix = parsed.scenePrefix;
                    cardName = parsed.cardName;
                }

                // Apply per-file override for enabled state (skip disabled files)
                const override = fileOverrides?.[file.name];
                if (override?.enabled === false) continue;

                processedFiles.push({ ...file, scenePrefix, cardName, description, override });
            }

            if (isAnalysis) {
                // Return file list for the Preview Dialog (no DB writes)
                const preview = processedFiles.map(file => {
                    const list = existingLists.find(l => fuzzyMatchList(file.scenePrefix, l.title));
                    const isDuplicate = list && cardMap.has(`${list.id}_${file.cardName.toLowerCase()}`);
                    return {
                        name: file.name,
                        url: file.url,
                        cardName: file.cardName,
                        scenePrefix: file.scenePrefix,
                        mimeType: file.mimeType,
                        matchedListTitle: list?.title || null,
                        matchedListId: list?.id || null,
                        isDuplicate: !!isDuplicate,
                    };
                });
                return { preview, totalFiles: allFiles.length, resolvedFiles: allFiles };
            }

            let ingestedCount = 0;
            let listOrder = Math.max(...existingLists.map(l => l.order), -1) + 1;
            const listRef = [...existingLists];

            await db.$transaction(async (tx) => {
                for (const file of processedFiles) {
                    const { scenePrefix, cardName, description, override } = file;
                    if (!cardName) continue;

                    // Determine list
                    let list = listRef.find(l => fuzzyMatchList(scenePrefix, l.title));
                    if (!list) {
                        const listTitle = scenePrefix || "Ingest";
                        list = await tx.list.create({
                            data: { title: listTitle, order: listOrder++, boardId }
                        });
                        listRef.push(list);
                    }

                    const cardKey = `${list.id}_${cardName.toLowerCase()}`;
                    let card = cardMap.get(cardKey);

                    if (card) {
                        const res = resolutions?.[file.name] || defaultResolution || "ignore";
                        if (res === "ignore") continue;
                        if (res === "replace") {
                            await tx.attachment.deleteMany({ where: { cardId: card.id } });
                        }
                    } else {
                        const lastOrder = existingCards.filter(c => c.listId === list!.id).reduce((max, c) => Math.max(max, c.order), -1);
                        
                        // Merge color/label: per-file override takes priority, then global
                        const cardColor = override?.color || globalColor || null;
                        const labelTitle = override?.label || globalLabel || null;
                        const labelColor = override?.labelColor || globalLabelColor || null;

                        card = await tx.card.create({
                            data: {
                                title: cardName,
                                description: description || null,
                                order: lastOrder + 1,
                                listId: list.id,
                                color: cardColor,
                                ...(labelTitle ? {
                                    labels: {
                                        create: [{
                                            title: labelTitle,
                                            color: labelColor || cardColor || "#6b7280",
                                        }]
                                    }
                                } : {}),
                            }
                        });
                        cardMap.set(cardKey, card);
                        existingCards.push(card);
                    }

                    const fileType = detectFileType(file.url);
                    const isImage = fileType === "image" || fileType === "svg";

                    await tx.attachment.create({
                        data: {
                            url: file.url,
                            title: file.name,
                            type: isImage ? "IMAGE" : "LINK",
                            isCover: isImage,
                            cardId: card.id,
                        }
                    });
                    ingestedCount++;
                }
            }, {
                timeout: 60000
            });

            revalidatePath(`/board/${boardId}`);
            return { count: ingestedCount };
        } catch (error: any) {
            console.error("[BulkIngest] Fatal Error:", error);
            throw new Error(error.message || "Failed to process folder.");
        }
    });
