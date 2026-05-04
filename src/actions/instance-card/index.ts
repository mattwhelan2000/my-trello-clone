"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { InstanceCardSchema } from "./schema";
import crypto from "crypto";

export const instanceCard = actionClient
    .schema(InstanceCardSchema)
    .action(async ({ parsedInput: { id, boardId, listIds, position } }) => {
        try {
            // 1. Fetch source card with ALL relations
            const sourceCard = await db.card.findUnique({
                where: { id },
                include: { 
                    attachments: true, 
                    labels: true,
                    checklists: { include: { items: true } } 
                },
            });
            if (!sourceCard) throw new Error("Source card not found");

            // 2. Ensure syncGroupId exists
            let syncGroupId = sourceCard.syncGroupId;
            if (!syncGroupId) {
                syncGroupId = crypto.randomUUID();
                await db.card.update({
                    where: { id },
                    data: { syncGroupId }
                });
            }

            // 3. Create instances in each list
            const results = [];
            for (const listId of listIds) {
                // Determine order
                let newOrder = 0;
                if (position !== undefined) {
                    // Find card at this position or end
                    const cardsInList = await db.card.findMany({
                        where: { listId },
                        orderBy: { order: "asc" },
                    });
                    
                    if (cardsInList.length === 0) {
                        newOrder = 0;
                    } else if (position <= 1) {
                        newOrder = cardsInList[0].order - 1;
                    } else if (position > cardsInList.length) {
                        newOrder = cardsInList[cardsInList.length - 1].order + 1;
                    } else {
                        // Insert between position-2 and position-1 (0-indexed)
                        const prev = cardsInList[position - 2];
                        const next = cardsInList[position - 1];
                        newOrder = (prev.order + next.order) / 2;
                    }
                } else {
                    const lastCard = await db.card.findFirst({
                        where: { listId },
                        orderBy: { order: "desc" },
                        select: { order: true },
                    });
                    newOrder = lastCard ? lastCard.order + 1 : 0;
                }

                const newCard = await db.card.create({
                    data: {
                        title: sourceCard.title,
                        description: sourceCard.description,
                        order: newOrder,
                        listId: listId,
                        dueDate: sourceCard.dueDate,
                        syncGroupId: syncGroupId,
                        color: sourceCard.color,
                        fontColor: sourceCard.fontColor,
                        attachments: {
                            createMany: {
                                data: sourceCard.attachments.map(att => ({
                                    url: att.url,
                                    type: att.type,
                                    title: att.title,
                                    thumbnailUrl: att.thumbnailUrl,
                                    isCover: att.isCover,
                                }))
                            }
                        },
                        labels: {
                            createMany: {
                                data: sourceCard.labels.map(label => ({
                                    title: label.title,
                                    color: label.color,
                                }))
                            }
                        }
                    },
                });

                // Copy checklists
                for (const checklist of sourceCard.checklists) {
                    await db.checklist.create({
                        data: {
                            cardId: newCard.id,
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
                results.push(newCard);
            }

            revalidatePath(`/board/${boardId}`);
            return { success: true, count: results.length };
        } catch (error: any) {
            console.error("[InstanceCard] Error:", error);
            throw new Error("Failed to instance card.");
        }
    });
