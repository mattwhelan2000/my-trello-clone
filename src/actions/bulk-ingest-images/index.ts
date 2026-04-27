"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { BulkIngestSchema } from "./schema";

// ── Dropbox API helpers ──────────────────────────────────────────────
// Resolves a Dropbox shared folder link into individual file entries with temporary download URLs.

interface DropboxFileEntry {
    name: string;
    path_lower: string;
    temporaryLink: string;
}

async function isDropboxFolderUrl(url: string): Promise<boolean> {
    // Dropbox shared folder links contain /scl/fo/ or /sh/ in the path
    return /dropbox\.com\/(scl\/fo|sh)\//.test(url);
}

async function resolveDropboxFolder(folderUrl: string): Promise<DropboxFileEntry[]> {
    const token = process.env.DROPBOX_ACCESS_TOKEN;
    if (!token) throw new Error("DROPBOX_ACCESS_TOKEN is not set");

    console.log(`[DropboxIngest] Resolving Folder: ${folderUrl}`);

    // Extract the base URL and query params
    const urlObj = new URL(folderUrl);
    const baseUrl = urlObj.origin + urlObj.pathname;
    const rlkey = urlObj.searchParams.get("rlkey");
    const st = urlObj.searchParams.get("st");

    // Construct common header set
    const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
    };

    // Step 1: List files in the shared folder using /2/files/list_folder
    const listRes = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
        method: "POST",
        headers,
        body: JSON.stringify({
            path: "",
            shared_link: { url: folderUrl },
            limit: 1000,
            recursive: false,
        }),
    });

    if (!listRes.ok) {
        const errText = await listRes.text();
        console.error(`[DropboxIngest] list_folder Error (${listRes.status}):`, errText);
        throw new Error(`Dropbox list_folder failed: ${listRes.status}`);
    }

    const listData = await listRes.json();
    console.log(`[DropboxIngest] Found ${listData.entries?.length || 0} total entries`);

    const entries: DropboxFileEntry[] = [];
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"];

    for (const entry of listData.entries || []) {
        if (entry[".tag"] !== "file") continue;
        
        const ext = entry.name.substring(entry.name.lastIndexOf(".")).toLowerCase();
        if (!imageExtensions.includes(ext)) continue;

        // Construct the direct download URL
        // For shared folder files, we append the filename to the folder path and keep the rlkey
        const fileUrl = new URL(baseUrl);
        // Ensure folder path ends with slash before appending filename
        if (!fileUrl.pathname.endsWith("/")) {
            fileUrl.pathname += "/";
        }
        fileUrl.pathname += entry.name;
        
        // Add back the auth keys
        if (rlkey) fileUrl.searchParams.set("rlkey", rlkey);
        if (st) fileUrl.searchParams.set("st", st);
        fileUrl.searchParams.set("raw", "1");

        entries.push({
            name: entry.name,
            path_lower: entry.path_lower,
            temporaryLink: fileUrl.toString(),
        });
    }

    return entries;
}

// ── Core ingest logic for a single file ──────────────────────────────

async function ingestSingleFile(
    boardId: string,
    filename: string,
    imageUrl: string
): Promise<boolean> {
    // Strip extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");

    // Split on the FIRST underscore: Sc007_BOARDS -> ["Sc007", "BOARDS"]
    const underscoreIndex = nameWithoutExt.indexOf('_');
    if (underscoreIndex === -1) {
        console.warn(`Skipping: Filename "${filename}" does not contain an underscore delimiter.`);
        return false;
    }

    const scenePrefix = nameWithoutExt.substring(0, underscoreIndex).trim();
    const cardName = nameWithoutExt.substring(underscoreIndex + 1).trim();

    if (!scenePrefix || !cardName) return false;

    // 1. Find the List by fuzzy-matching the scene prefix against existing list titles.
    //    e.g. "Sc007" matches "Sc007 EXT. -- 1+1/8 pgs"
    const allLists = await db.list.findMany({
        where: { boardId },
        orderBy: { order: "asc" },
    });

    let list = allLists.find(
        (l) => l.title.toLowerCase().startsWith(scenePrefix.toLowerCase())
    ) || null;

    if (!list) {
        // No matching list found — create one with just the scene prefix
        const lastOrder = allLists.length > 0 ? allLists[allLists.length - 1].order : 0;
        list = await db.list.create({
            data: {
                title: scenePrefix,
                order: lastOrder + 1,
                boardId
            }
        });
    }

    // 2. Find or create the Card
    let card = await db.card.findFirst({
        where: { title: cardName, listId: list.id }
    });

    if (!card) {
        const lastCard = await db.card.findFirst({
            where: { listId: list.id },
            orderBy: { order: "desc" },
            select: { order: true },
        });
        const newOrder = lastCard ? lastCard.order + 1 : 1;

        card = await db.card.create({
            data: {
                title: cardName,
                order: newOrder,
                listId: list.id
            }
        });
    }

    // 3. Attach image to card as cover (skip if already attached)
    const rawUrl = imageUrl.replace('dl=0', 'raw=1').replace('dl=1', 'raw=1');

    const existingAttachment = await db.attachment.findFirst({
        where: { cardId: card.id, url: rawUrl }
    });

    if (!existingAttachment) {
        await db.attachment.create({
            data: {
                url: rawUrl,
                title: filename,
                type: "IMAGE",
                isCover: true,
                cardId: card.id
            }
        });
        return true;
    }

    return false;
}

// ── Main action ──────────────────────────────────────────────────────

export const bulkIngestImages = actionClient
    .schema(BulkIngestSchema)
    .action(async ({ parsedInput: { boardId, urls } }) => {
        try {
            let ingestedCount = 0;

            for (const url of urls) {
                try {
                    const trimmedUrl = url.trim();
                    if (!trimmedUrl) continue;

                    // Check if this is a Dropbox folder link
                    if (await isDropboxFolderUrl(trimmedUrl)) {
                        console.log(`Resolving Dropbox folder: ${trimmedUrl}`);
                        const files = await resolveDropboxFolder(trimmedUrl);
                        console.log(`Found ${files.length} image files in Dropbox folder`);

                        for (const file of files) {
                            try {
                                const success = await ingestSingleFile(boardId, file.name, file.temporaryLink);
                                if (success) ingestedCount++;
                            } catch (e) {
                                console.error(`Failed processing Dropbox file: ${file.name}`, e);
                            }
                        }
                    } else {
                        // Individual file URL — extract filename from URL path
                        const urlObj = new URL(trimmedUrl);
                        const pathname = decodeURIComponent(urlObj.pathname);
                        const segments = pathname.split('/');
                        const filenameWithExt = segments[segments.length - 1];
                        if (!filenameWithExt) continue;

                        const success = await ingestSingleFile(boardId, filenameWithExt, trimmedUrl);
                        if (success) ingestedCount++;
                    }
                } catch (e) {
                    console.error("Failed processing URL:", url, e);
                }
            }

            revalidatePath(`/board/${boardId}`);
            return { data: { count: ingestedCount } };
        } catch (error) {
            return { error: "Failed to ingest images." };
        }
    });
