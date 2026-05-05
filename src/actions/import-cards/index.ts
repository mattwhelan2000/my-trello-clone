"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { parseFilename, fuzzyMatchList } from "@/lib/import-utils";

export const importCards = actionClient
    .schema(ImportCardsSchema)
    .action(async ({ parsedInput: { boardId, listId, cardsJson } }) => {
        try {
            let cardsToImport = JSON.parse(cardsJson);
            
            // Ensure cardsToImport is an array
            if (!Array.isArray(cardsToImport)) {
                cardsToImport = [cardsToImport];
            }

            // Fetch all lists for the board to support fuzzy matching
            const allLists = await db.list.findMany({
                where: { boardId },
                orderBy: { order: "asc" }
            });

            const defaultList = allLists.find(l => l.id === listId);
            if (!defaultList) throw new Error("Target list not found");

            const results = [];

            // We need to keep track of orders for each list we might insert into
            const listOrders: Record<string, number> = {};
            
            // Initialize orders for lists we touch
            for (const l of allLists) {
                const lastCard = await db.card.findFirst({
                    where: { listId: l.id },
                    orderBy: { order: "desc" },
                    select: { order: true }
                });
                listOrders[l.id] = lastCard ? lastCard.order + 1 : 0;
            }

            for (const cardData of cardsToImport) {
                // Determine target list based on fuzzy matching
                let targetListId = listId;
                const { scenePrefix } = parseFilename(cardData.title || "");
                
                if (scenePrefix) {
                    const matchedList = allLists.find(l => fuzzyMatchList(scenePrefix, l.title));
                    if (matchedList) {
                        targetListId = matchedList.id;
                    }
                }

                const card = await db.card.create({
                    data: {
                        title: cardData.title || "Untitled Card",
                        description: cardData.description,
                        order: listOrders[targetListId]++,
                        listId: targetListId,
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
