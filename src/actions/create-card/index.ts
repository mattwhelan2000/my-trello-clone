"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateCardSchema } from "./schema";

export const createCard = actionClient
    .schema(CreateCardSchema)
    .action(async ({ parsedInput: { title, boardId, listId, imageUrl } }) => {
        try {
            const list = await db.list.findUnique({
                where: { id: listId, boardId },
            });

            if (!list) {
                return { error: "List not found" };
            }

            const lastCard = await db.card.findFirst({
                where: { listId },
                orderBy: { order: "desc" },
                select: { order: true },
            });

            const newOrder = lastCard ? lastCard.order + 1 : 0;

            const cardData: any = {
                title,
                listId,
                order: newOrder,
            };

            if (imageUrl) {
                const isImage = imageUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) || imageUrl.includes("dropbox.com");
                const type = isImage ? "IMAGE" : "LINK";
                let fetchedTitle = imageUrl;
                let thumbnailUrl = null;

                if (type === "LINK") {
                    try {
                        const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(imageUrl)}`);
                        if (res.ok) {
                            const data = await res.json();
                            fetchedTitle = data.data?.title || fetchedTitle;
                            thumbnailUrl = data.data?.image?.url || null;

                            // If this was a pasted URL, the original title was likely just "Pasted Image", overwrite it with the real title
                            cardData.title = fetchedTitle;
                        }
                    } catch (e) {
                        console.error("Failed to fetch link metadata", e);
                    }
                }

                cardData.attachments = {
                    create: {
                        url: imageUrl,
                        type,
                        title: fetchedTitle,
                        thumbnailUrl,
                    }
                };
            }

            const card = await db.card.create({
                data: cardData,
            });

            revalidatePath(`/board/${boardId}`);
            return card;
        } catch (error) {
            return { error: "Failed to create card." };
        }
    });
