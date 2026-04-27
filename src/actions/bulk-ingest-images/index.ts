"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { BulkIngestSchema } from "./schema";

export const bulkIngestImages = actionClient
    .schema(BulkIngestSchema)
    .action(async ({ parsedInput: { boardId, urls } }) => {
        try {
            let ingestedCount = 0;

            for (const url of urls) {
                try {
                    // Try to extract the filename from the URL path.
                    // Example: https://.../List%20Name---Card%20Name.jpg?dl=0
                    const urlObj = new URL(url);
                    const pathname = decodeURIComponent(urlObj.pathname);
                    const segments = pathname.split('/');
                    const filenameWithExt = segments[segments.length - 1];
                    
                    if (!filenameWithExt) continue;

                    // Strip extension
                    const filename = filenameWithExt.replace(/\.[^/.]+$/, "");

                    // Check for the delimiter '---'
                    const parts = filename.split('---');
                    if (parts.length !== 2) {
                        console.warn(`Skipping URL: Filename "${filename}" does not contain the '---' delimiter.`);
                        continue;
                    }

                    const listName = parts[0].trim();
                    const cardName = parts[1].trim();

                    if (!listName || !cardName) continue;

                    // 1. Find or create the List
                    let list = await db.list.findFirst({
                        where: { title: listName, boardId }
                    });

                    if (!list) {
                        const lastList = await db.list.findFirst({
                            where: { boardId },
                            orderBy: { order: "desc" },
                            select: { order: true },
                        });
                        const newOrder = lastList ? lastList.order + 1 : 1;
                        
                        list = await db.list.create({
                            data: {
                                title: listName,
                                order: newOrder,
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

                    // 3. Attach image to card (only if it doesn't already exist to avoid spamming)
                    // Ensure the URL can act as raw image link. For dropbox, replace dl=0 with raw=1
                    const rawUrl = url.replace('dl=0', 'raw=1').replace('dl=1', 'raw=1');
                    
                    const existingAttachment = await db.attachment.findFirst({
                        where: { cardId: card.id, url: rawUrl }
                    });

                    if (!existingAttachment) {
                        await db.attachment.create({
                            data: {
                                url: rawUrl,
                                title: filenameWithExt,
                                type: "IMAGE",
                                isCover: true,
                                cardId: card.id
                            }
                        });
                        ingestedCount++;
                    }

                } catch (e) {
                    console.error("Failed processing URL: ", url, e);
                }
            }

            revalidatePath(`/board/${boardId}`);
            return { data: { count: ingestedCount } };
        } catch (error) {
            return { error: "Failed to ingest images." };
        }
    });
