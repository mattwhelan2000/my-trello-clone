"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { AddLabelsBatchSchema } from "./schema";

export const addLabelsBatch = actionClient
    .schema(AddLabelsBatchSchema)
    .action(async ({ parsedInput: { cardIds, boardId, labelTitle, labelColor } }) => {
        try {
            console.log(`[AddLabelsBatch] EXECUTING: Adding label '${labelTitle}' to ${cardIds.length} cards...`);
            if (cardIds.length === 0) return { success: true };

            // Use a transaction with a generous timeout for large boards
            await db.$transaction(async (tx) => {
                // 1. Identify which cards already HAVE this label to avoid duplicates
                const CHUNK_SIZE = 500;
                let existingCardIds = new Set<string>();

                for (let i = 0; i < cardIds.length; i += CHUNK_SIZE) {
                    const chunk = cardIds.slice(i, i + CHUNK_SIZE);
                    const existingLabels = await tx.label.findMany({
                        where: {
                            cardId: { in: chunk },
                            title: {
                                equals: labelTitle,
                                mode: 'insensitive'
                            }
                        },
                        select: { cardId: true }
                    });
                    existingLabels.forEach(l => existingCardIds.add(l.cardId));
                }

                const cardsToLabel = cardIds.filter(id => !existingCardIds.has(id));

                if (cardsToLabel.length === 0) {
                    console.log("[AddLabelsBatch] All cards already have this label.");
                    return;
                }

                // 2. Perform Bulk Create in chunks
                for (let i = 0; i < cardsToLabel.length; i += CHUNK_SIZE) {
                    const chunk = cardsToLabel.slice(i, i + CHUNK_SIZE);
                    await tx.label.createMany({
                        data: chunk.map(cardId => ({
                            cardId,
                            title: labelTitle,
                            color: labelColor
                        })),
                        skipDuplicates: true
                    });
                }

            }, {
                timeout: 120000 // 120s timeout for massive boards
            });

            console.log(`[AddLabelsBatch] Successfully added labels to ${cardIds.length} cards.`);
            
            // Hard revalidation of the board cache
            revalidatePath(`/board/${boardId}`);
            revalidatePath(`/(platform)/board/${boardId}`, "layout");
            
            return { success: true, count: cardIds.length };
        } catch (error: any) {
            console.error("[AddLabelsBatch] Fatal Error:", error);
            return { error: error.message || "Failed to add labels." };
        }
    });
