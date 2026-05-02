"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";

import { UpdateCardsBatchSchema } from "./schema";

export const updateCardsBatch = actionClient
  .schema(UpdateCardsBatchSchema)
  .action(async ({ parsedInput: { 
    ids, 
    boardId, 
    rank, 
    labels, 
    dueDate, 
    url, 
    delete: shouldDelete, 
    displayThumbnails, 
    isSlim,
    addChecklist
  } }) => {
  try {
    // 1. BATCH DELETE
    if (shouldDelete) {
      await db.card.deleteMany({
        where: {
          id: { in: ids },
          list: { boardId }
        }
      });
      
      revalidatePath(`/board/${boardId}`);
      return { success: true, count: ids.length, action: "delete" };
    }

    // 2. RANK UPDATES (List by List)
    if (rank !== undefined && rank !== null) {
        // Get all affected cards to know which lists they belong to
        const affectedCards = await db.card.findMany({
            where: { id: { in: ids } },
            select: { id: true, listId: true, order: true }
        });

        const listsMap = new Map<string, string[]>();
        affectedCards.forEach(c => {
            if (!listsMap.has(c.listId)) listsMap.set(c.listId, []);
            listsMap.get(c.listId)!.push(c.id);
        });

        for (const [listId, cardIdsInList] of listsMap.entries()) {
            // Get all cards in this list
            const allCardsInList = await db.card.findMany({
                where: { listId },
                orderBy: { order: "asc" }
            });

            const movingIds = new Set(cardIdsInList);
            const batchToMove = allCardsInList.filter(c => movingIds.has(c.id));
            const remainingCards = allCardsInList.filter(c => !movingIds.has(c.id));

            // Insert at rank-1
            const insertIdx = Math.max(0, Math.min(rank - 1, remainingCards.length));
            const reorderedCards = [...remainingCards];
            reorderedCards.splice(insertIdx, 0, ...batchToMove);

            // Bulk update orders
            const updatePromises = reorderedCards.map((card, index) => 
                db.card.update({
                    where: { id: card.id },
                    data: { order: index }
                })
            );
            await Promise.all(updatePromises);
        }
    }

    // 3. PROPERTY UPDATES (Everything else)
    const updateData: any = {};
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (displayThumbnails !== undefined) updateData.displayThumbnails = displayThumbnails;
    if (isSlim !== undefined) updateData.isSlim = isSlim;

    if (Object.keys(updateData).length > 0) {
        await db.card.updateMany({
            where: { id: { in: ids } },
            data: updateData
        });
    }

    // 4. LABELS (Add to all)
    if (labels && labels.length > 0) {
        for (const id of ids) {
            for (const label of labels) {
                // Check if card already has this label to avoid duplicates
                const existing = await db.label.findFirst({
                    where: { cardId: id, title: label.title, color: label.color }
                });
                if (!existing) {
                    await db.label.create({
                        data: {
                            cardId: id,
                            title: label.title,
                            color: label.color,
                        }
                    });
                }
            }
        }
    }

    // 5. ATTACH URL
    if (url) {
        for (const id of ids) {
            await db.attachment.create({
                data: {
                    cardId: id,
                    url,
                    title: "Batch Attachment",
                    type: "URL"
                }
            });
        }
    }

    // 6. ADD CHECKLIST
    if (addChecklist) {
        for (const id of ids) {
            await db.checklist.create({
                data: {
                    cardId: id,
                    title: "Checklist"
                }
            });
        }
    }

    revalidatePath(`/board/${boardId}`);
    return { success: true, count: ids.length };

  } catch (error) {
    console.error("[BATCH_UPDATE_ERROR]", error);
    return {
      error: "Failed to update cards batch."
    }
  }
});
