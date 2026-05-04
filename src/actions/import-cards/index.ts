"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { ImportCardsSchema } from "./schema";

export const importCards = actionClient
    .schema(ImportCardsSchema)
    .action(async ({ parsedInput: { boardId, listId, cardsJson } }) => {
        try {
            let cardsToImport = JSON.parse(cardsJson);
            
            // Ensure cardsToImport is an array
            if (!Array.isArray(cardsToImport)) {
                cardsToImport = [cardsToImport];
            }

            const list = await db.list.findUnique({
                where: { id: listId, boardId },
            });

            if (!list) throw new Error("List not found");

            const lastCard = await db.card.findFirst({
                where: { listId },
                orderBy: { order: "desc" },
                select: { order: true },
            });

            let currentOrder = lastCard ? lastCard.order + 1 : 0;

            const results = [];

            for (const cardData of cardsToImport) {
                const card = await db.card.create({
                    data: {
                        title: cardData.title || "Untitled Card",
                        description: cardData.description,
                        order: currentOrder++,
                        listId: listId,
                        color: cardData.color,
                        fontColor: cardData.fontColor,
                        isSlim: cardData.isSlim ?? false,
                        displayThumbnails: cardData.displayThumbnails ?? true,
                        dueDate: cardData.dueDate ? new Date(cardData.dueDate) : null,
                        labels: {
                            create: (cardData.labels || []).map((l: any) => ({
                                title: l.title,
                                color: l.color,
                            }))
                        },
                        attachments: {
                            create: (cardData.attachments || []).map((a: any) => ({
                                url: a.url,
                                type: a.type,
                                title: a.title,
                                thumbnailUrl: a.thumbnailUrl,
                                isCover: a.isCover ?? false,
                            }))
                        },
                        checklists: {
                            create: (cardData.checklists || []).map((c: any) => ({
                                title: c.title,
                                items: {
                                    create: (c.items || []).map((i: any) => ({
                                        title: i.title,
                                        isCompleted: i.isCompleted ?? false,
                                    }))
                                }
                            }))
                        }
                    }
                });
                results.push(card);
            }

            revalidatePath(`/board/${boardId}`);
            return { success: true, count: results.length };
        } catch (error) {
            console.error("[importCards] Error:", error);
            throw new Error("Failed to import cards. Please ensure the JSON is valid.");
        }
    });
