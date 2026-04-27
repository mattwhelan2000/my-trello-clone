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

    // Step 1: Get the shared folder metadata to find the shared link's folder path
    // We use /2/sharing/get_shared_link_metadata to resolve the shared link
    const metaRes = await fetch("https://api.dropboxapi.com/2/sharing/get_shared_link_metadata", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: folderUrl }),
    });

    if (!metaRes.ok) {
        const errText = await metaRes.text();
        console.error("Dropbox metadata error:", errText);
        throw new Error(`Failed to get Dropbox folder metadata: ${metaRes.status}`);
    }

    const meta = await metaRes.json();
    console.log("Dropbox folder metadata:", JSON.stringify(meta, null, 2));

    // Step 2: List files in the shared folder using /2/files/list_folder
    // For shared links, we use the shared_link parameter
    const listRes = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            path: "",
            shared_link: { url: folderUrl },
            limit: 2000,
        }),
    });

    if (!listRes.ok) {
        const errText = await listRes.text();
        console.error("Dropbox list_folder error:", errText);
        throw new Error(`Failed to list Dropbox folder: ${listRes.status}`);
    }

    const listData = await listRes.json();
    const entries: DropboxFileEntry[] = [];

    // Filter to only files (not subfolders), and only image types
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff"];

    for (const entry of listData.entries || []) {
        if (entry[".tag"] !== "file") continue;
        const ext = entry.name.substring(entry.name.lastIndexOf(".")).toLowerCase();
        if (!imageExtensions.includes(ext)) continue;

        // Step 3: Get a temporary direct download link for each file
        const tempLinkRes = await fetch("https://api.dropboxapi.com/2/sharing/get_shared_link_file", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Dropbox-API-Arg": JSON.stringify({
                    url: folderUrl,
                    path: `/${entry.name}`,
                }),
            },
        });

        if (tempLinkRes.ok) {
            // The actual file content is in the response body, but we want a URL.
            // Instead, construct a direct download URL from the shared folder link
            const directUrl = folderUrl.split("?")[0] + `/${encodeURIComponent(entry.name)}?dl=1`;

            entries.push({
                name: entry.name,
                path_lower: entry.path_lower,
                temporaryLink: directUrl,
            });
        } else {
            // Fallback: construct a raw URL from the folder link
            const directUrl = folderUrl.split("?")[0] + `/${encodeURIComponent(entry.name)}?raw=1`;
            entries.push({
                name: entry.name,
                path_lower: entry.path_lower,
                temporaryLink: directUrl,
            });
        }
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
