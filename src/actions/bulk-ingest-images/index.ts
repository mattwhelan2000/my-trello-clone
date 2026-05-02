"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { BulkIngestSchema } from "./schema";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];
const DRIVE_API = "https://www.googleapis.com/drive/v3";

async function listDriveFolder(folderId: string): Promise<{ name: string; url: string; id: string }[]> {
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_DRIVE_API_KEY is not set.");

    const results: { name: string; url: string; id: string }[] = [];
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
            if (!file.mimeType.startsWith("image/")) continue;
            const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
            if (!IMAGE_EXTENSIONS.includes(ext)) continue;

            const url = `/api/drive-image?id=${file.id}`;
            results.push({ name: file.name, url, id: file.id });
        }
        pageToken = data.nextPageToken;
    } while (pageToken);

    return results;
}

function extractNumbers(str: string): number[] {
    return (str.match(/\d+/g) || []).map(Number);
}

function fuzzyMatchList(prefix: string, listTitle: string): boolean {
    const prefixNums = extractNumbers(prefix);
    const listNums = extractNumbers(listTitle);
    if (prefixNums.length === 0 || listNums.length === 0) return false;
    return prefixNums[0] === listNums[0];
}

function parseFilename(name: string) {
    const nameWithoutExt = name.replace(/\.[^/.]+$/, "");
    const delimiter = nameWithoutExt.includes("_") ? "_" : " ";
    const parts = nameWithoutExt.split(delimiter);
    if (parts.length > 1) {
        return { scenePrefix: parts[0].trim(), cardName: parts.slice(1).join(delimiter).trim() };
    }
    return { scenePrefix: "Drive Ingest", cardName: nameWithoutExt.trim() };
}

export const bulkIngestImages = actionClient
    .schema(BulkIngestSchema)
    .action(async ({ parsedInput: { boardId, urls, isAnalysis, resolutions, defaultResolution, resolvedFiles } }) => {
        try {
            console.log(`[BulkIngest] Optimized Transaction Start (${boardId})`);

            let allFiles = resolvedFiles || [];
            if (allFiles.length === 0) {
                for (const url of urls) {
                    const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                    if (match) allFiles.push(...(await listDriveFolder(match[1])));
                }
            }
            if (allFiles.length === 0) return { count: 0 };

            const existingLists = await db.list.findMany({ where: { boardId } });
            const existingCards = await db.card.findMany({ 
                where: { listId: { in: existingLists.map(l => l.id) } }
            });
            const cardMap = new Map(existingCards.map(c => [`${c.listId}_${c.title.toLowerCase()}`, c]));

            if (isAnalysis) {
                const conflicts: any[] = [];
                for (const file of allFiles) {
                    const { scenePrefix, cardName } = parseFilename(file.name);
                    const list = existingLists.find(l => fuzzyMatchList(scenePrefix, l.title));
                    if (list && cardMap.has(`${list.id}_${cardName.toLowerCase()}`)) {
                        conflicts.push({ name: file.name, cardName, listTitle: list.title });
                    }
                }
                if (conflicts.length === 0) { isAnalysis = false; }
                else { return { conflicts, totalFiles: allFiles.length, resolvedFiles: allFiles }; }
            }

            let ingestedCount = 0;
            let listOrder = Math.max(...existingLists.map(l => l.order), -1) + 1;
            const listRef = [...existingLists];

            // Perform all operations in a single Transaction for speed
            await db.$transaction(async (tx) => {
                for (const file of allFiles) {
                    const { scenePrefix, cardName } = parseFilename(file.name);
                    if (!cardName) continue;

                    let list = listRef.find(l => fuzzyMatchList(scenePrefix, l.title));
                    if (!list) {
                        list = await tx.list.create({
                            data: { title: scenePrefix, order: listOrder++, boardId }
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
                        card = await tx.card.create({
                            data: { title: cardName, order: lastOrder + 1, listId: list.id }
                        });
                        cardMap.set(cardKey, card);
                        existingCards.push(card);
                    }

                    await tx.attachment.create({
                        data: {
                            url: file.url,
                            title: file.name,
                            type: "IMAGE",
                            isCover: true,
                            cardId: card.id,
                        }
                    });
                    ingestedCount++;
                }
            }, {
                timeout: 30000 // Increase timeout to 30s for large batches
            });

            revalidatePath(`/board/${boardId}`);
            return { count: ingestedCount };
        } catch (error: any) {
            console.error("[BulkIngest] Fatal Error:", error);
            return { error: error.message || "Failed to process folder." };
        }
    });
