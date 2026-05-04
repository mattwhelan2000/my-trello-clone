"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DeleteChecklistSchema } from "./schema";

export const deleteChecklist = actionClient
    .schema(DeleteChecklistSchema)
    .action(async ({ parsedInput: { id, boardId } }) => {
        try {
            const checklistToDelete = await db.checklist.findUnique({
                where: { id },
                include: { card: { select: { syncGroupId: true } } }
            });

            if (!checklistToDelete) throw new Error("Checklist not found");

            if (checklistToDelete.card?.syncGroupId) {
                const syncedCards = await db.card.findMany({
                    where: { syncGroupId: checklistToDelete.card.syncGroupId },
                    select: { id: true }
                });

                await db.checklist.deleteMany({
                    where: {
                        cardId: { in: syncedCards.map(c => c.id) },
                        title: checklistToDelete.title
                    }
                });
            } else {
                await db.checklist.delete({
                    where: { id },
                });
            }

            revalidatePath(`/board/${boardId}`);
            return { success: true };
        } catch (error) {
            throw new Error("Failed to delete checklist.");
        }
    });
