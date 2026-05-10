"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { ImportCardsSchema } from "./schema";
import { parseFilename, fuzzyMatchList } from "@/lib/import-utils";

export const importCards = actionClient
    .schema(ImportCardsSchema)
    .action(async ({ parsedInput: { boardId, listId, cardsJson, isAnalysis, cardOverrides, globalColor, globalLabel, globalLabelColor } }) => {
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

            // Fetch existing cards to detect duplicates
            const existingCards = await db.card.findMany({
                where: { listId: { in: allLists.map(l => l.id) } },
                select: { title: true, listId: true }
            });

            if (isAnalysis) {
                const preview = cardsToImport.map((cardData: any, index: number) => {
                    const title = cardData.title || `Card ${index + 1}`;
                    const { scenePrefix } = parseFilename(title);
                    
                    let matchedList = allLists.find(l => l.id === listId);
                    if (scenePrefix) {
                        const fuzzy = allLists.find(l => fuzzyMatchList(scenePrefix, l.title));
                        if (fuzzy) matchedList = fuzzy;
                    }

                    const isDuplicate = existingCards.some(ec => 
                        ec.title.toLowerCase() === title.toLowerCase() && 
                        ec.listId === matchedList?.id
                    );

                    return {
                        name: title, // Using name for the unique key in UI
                        url: "",
                        cardName: title,
                        scenePrefix,
                        mimeType: "application/json",
                        matchedListTitle: matchedList?.title || null,
                        matchedListId: matchedList?.id || null,
                        isDuplicate,
                        // Pass through original data
                        data: cardData
                    };
                });

                return { preview, success: true };
            }

            // --- ACTUAL IMPORT MODE ---
            const results = [];
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
                const title = cardData.title || "Untitled Card";
                const override = cardOverrides?.[title];

                // Skip if disabled in preview
                if (override && override.enabled === false) continue;

                // Determine target list
                let targetListId = override?.listId || listId;
                if (!override?.listId) {
                    const { scenePrefix } = parseFilename(title);
                    if (scenePrefix) {
                        const matchedList = allLists.find(l => fuzzyMatchList(scenePrefix, l.title));
                        if (matchedList) {
                            targetListId = matchedList.id;
                        }
                    }
                }

                // Merge color/label: per-file override > global > original data
                const finalColor = override?.color || globalColor || cardData.color || null;
                const finalLabel = override?.label || globalLabel || null;
                const finalLabelColor = override?.labelColor || globalLabelColor || null;

                const card = await db.card.create({
                    data: {
                        title: title,
                        description: cardData.description,
                        order: listOrders[targetListId]++,
                        listId: targetListId,
                        color: finalColor,
                        fontColor: cardData.fontColor,
                        isSlim: cardData.isSlim ?? false,
                        displayThumbnails: cardData.displayThumbnails ?? true,
                        dueDate: cardData.dueDate ? new Date(cardData.dueDate) : null,
                        labels: {
                            create: [
                                ...(cardData.labels || []).map((l: any) => ({
                                    title: l.title,
                                    color: l.color,
                                })),
                                ...(finalLabel ? [{
                                    title: finalLabel,
                                    color: finalLabelColor || "#6b7280",
                                }] : [])
                            ]
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
