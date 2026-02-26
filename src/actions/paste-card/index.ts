"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { PasteCardSchema } from "./schema";

export const pasteCard = actionClient
    .schema(PasteCardSchema)
    .action(async ({ parsedInput: { sourceCardId, targetListId, boardId } }) => {
        try {
            const cardToCopy = await db.card.findUnique({
                where: { id: sourceCardId },
                include: { attachments: true },
            });
            if (!cardToCopy) return { error: "Source card not found" };

            const lastCard = await db.card.findFirst({
                where: { listId: targetListId },
                orderBy: { order: "desc" },
                select: { order: true },
            });
            const newOrder = lastCard ? lastCard.order + 1 : 0;

            const card = await db.card.create({
                data: {
                    title: cardToCopy.title,
                    description: cardToCopy.description,
                    order: newOrder,
                    listId: targetListId,
                    dueDate: cardToCopy.dueDate,
                    attachments: {
                        createMany: {
                            data: cardToCopy.attachments.map(att => ({
                                url: att.url,
                                type: att.type,
                                title: att.title,
                                thumbnailUrl: att.thumbnailUrl,
                            }))
                        }
                    }
                },
            });

            revalidatePath(`/board/${boardId}`);
            return card;
        } catch (error) {
            return { error: "Failed to paste card." };
        }
    });
