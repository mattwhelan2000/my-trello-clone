"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { MoveCardsBatchSchema } from "./schema";

export const moveCardsBatch = actionClient
    .schema(MoveCardsBatchSchema)
    .action(async ({ parsedInput: { ids, boardId, targetPosition } }) => {
        try {
            console.log(`[MoveCardsBatch] EXECUTING: Moving ${ids.length} cards to Pos #${targetPosition} on Board ${boardId}`);
            if (ids.length === 0) return { success: true };

            await db.$transaction(async (tx) => {
                // 1. Fetch current state of these cards inside the transaction
                const cardsToMove = await tx.card.findMany({
                    where: { id: { in: ids } },
                    select: { id: true, listId: true }
                });

                const listIds = Array.from(new Set(cardsToMove.map(c => c.listId)));
                console.log(`[MoveCardsBatch] Cards span ${listIds.length} lists: ${listIds.join(", ")}`);

                for (const listId of listIds) {
                    // Fetch ALL cards in this specific list
                    const allCardsInList = await tx.card.findMany({
                        where: { listId },
                        orderBy: { order: "asc" }
                    });

                    const movingIdsInThisList = cardsToMove
                        .filter(c => c.listId === listId)
                        .map(c => c.id);

                    const otherCards = allCardsInList.filter(c => !movingIdsInThisList.includes(c.id));
                    const movingCards = allCardsInList.filter(c => movingIdsInThisList.includes(c.id));

                    // targetPosition is 1-indexed. index 0 is position #1.
                    // Clamp it between 0 and the new total length
                    const insertIdx = Math.max(0, Math.min(targetPosition - 1, otherCards.length));

                    const newList = [...otherCards];
                    newList.splice(insertIdx, 0, ...movingCards);

                    console.log(`[MoveCardsBatch] List ${listId}: Reordering ${newList.length} cards. InsertIdx: ${insertIdx}`);

                    // PASS 1: Move everyone to a high temporary order to avoid unique constraints/collisions
                    for (let i = 0; i < newList.length; i++) {
                        await tx.card.update({
                            where: { id: newList[i].id },
                            data: { order: 50000 + i }
                        });
                    }

                    // PASS 2: Move everyone to their final 0-indexed position
                    for (let i = 0; i < newList.length; i++) {
                        await tx.card.update({
                            where: { id: newList[i].id },
                            data: { order: i }
                        });
                    }
                }
            }, {
                timeout: 30000
            });

            console.log(`[MoveCardsBatch] Transaction Complete.`);
            
            // Aggressive revalidation
            revalidatePath(`/board/${boardId}`);
            revalidatePath(`/(platform)/board/${boardId}`, "layout");
            
            return { success: true, count: ids.length, boardId };
        } catch (error: any) {
            console.error("[MoveCardsBatch] Fatal Error:", error);
            throw new Error(error.message || "Failed to move cards.");
        }
    });
