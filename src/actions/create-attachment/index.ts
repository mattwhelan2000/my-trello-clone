"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateAttachmentSchema } from "./schema";

export const createAttachment = actionClient
    .schema(CreateAttachmentSchema)
    .action(async ({ parsedInput: { id, url, type, boardId, title: customTitle } }) => {
        try {
            let title = customTitle || url;
            let thumbnailUrl = null;

            if (type === "LINK") {
                try {
                    const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`);
                    if (res.ok) {
                        const data = await res.json();
                        title = data.data?.title || title;
                        thumbnailUrl = data.data?.image?.url || null;
                    }
                } catch (e) {
                    console.error("Failed to fetch link metadata", e);
                }
            }

            const card = await db.card.findUnique({
                where: { id },
                select: { syncGroupId: true }
            });

            if (card?.syncGroupId) {
                const syncedCards = await db.card.findMany({
                    where: { syncGroupId: card.syncGroupId },
                    select: { id: true }
                });

                await db.attachment.createMany({
                    data: syncedCards.map(c => ({
                        cardId: c.id,
                        url,
                        type,
                        title,
                        thumbnailUrl,
                        isCover: type === "IFRAME",
                    }))
                });
            } else {
                const attachment = await db.attachment.create({
                    data: {
                        cardId: id,
                        url,
                        type,
                        title,
                        thumbnailUrl,
                        isCover: type === "IFRAME",
                    },
                });

                if (type === "IFRAME") {
                    await db.attachment.updateMany({
                        where: {
                            cardId: id,
                            id: { not: attachment.id },
                        },
                        data: { isCover: false },
                    });
                }
            }

            revalidatePath(`/board/${boardId}`);
            return { success: true };
        } catch (error) {
            throw new Error("Failed to create attachment.");
        }
    });
