"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CloneCardSchema } from "./schema";
import { v4 as uuidv4 } from "uuid";

export const cloneCard = actionClient
    .schema(CloneCardSchema)
    .action(async ({ parsedInput: { id, boardId } }) => {
        try {
            let cardToCopy = await db.card.findUnique({
                where: { id },
                include: { attachments: true, checklists: { include: { items: true } } },
            });
            if (!cardToCopy) return { error: "Card not found" };

            let syncGroupId = cardToCopy.syncGroupId;
            if (!syncGroupId) {
                syncGroupId = uuidv4();
                // Update original card with new sync group
                await db.card.update({
                    where: { id },
                    data: { syncGroupId }
                });
            }

            const lastCard = await db.card.findFirst({
                where: { listId: cardToCopy.listId },
                orderBy: { order: "desc" },
                select: { order: true },
            });
            const newOrder = lastCard ? lastCard.order + 1 : 0;

            const card = await db.card.create({
                data: {
                    title: cardToCopy.title,
                    description: cardToCopy.description,
                    order: newOrder,
                    listId: cardToCopy.listId,
                    dueDate: cardToCopy.dueDate,
                    syncGroupId: syncGroupId,
                    color: cardToCopy.color,
                    fontColor: cardToCopy.fontColor,
                    attachments: {
                        createMany: {
                            data: cardToCopy.attachments.map(att => ({
                                url: att.url,
                                type: att.type,
                                title: att.title,
                                thumbnailUrl: att.thumbnailUrl,
                                isCover: att.isCover,
                            }))
                        }
                    }
                },
            });

            // Need to copy checklists manually since createMany is not supported for nested relations on arrays in sqlite, 
            // but we are using postgresql! 
            // Wait, createMany is not supported on nested relations, you have to create them
            for (const checklist of cardToCopy.checklists) {
                await db.checklist.create({
                    data: {
                        cardId: card.id,
                        title: checklist.title,
                        items: {
                            createMany: {
                                data: checklist.items.map(item => ({
                                    title: item.title,
                                    isCompleted: item.isCompleted,
                                }))
                            }
                        }
                    }
                });
            }

            revalidatePath(`/board/${boardId}`);
            return card;
        } catch (error) {
            return { error: "Failed to clone card." };
        }
    });
