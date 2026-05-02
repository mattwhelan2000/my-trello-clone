"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DeleteLabelSchema } from "./schema";

export const deleteLabel = actionClient
    .schema(DeleteLabelSchema)
    .action(async ({ parsedInput: { id, boardId } }) => {
        try {
            const labelToDelete = await db.label.findUnique({
                where: { id },
                include: { card: { select: { syncGroupId: true } } }
            });

            if (!labelToDelete) return { error: "Label not found" };

            if (labelToDelete.card?.syncGroupId) {
                const syncedCards = await db.card.findMany({
                    where: { syncGroupId: labelToDelete.card.syncGroupId },
                    select: { id: true }
                });

                await db.label.deleteMany({
                    where: {
                        cardId: { in: syncedCards.map(c => c.id) },
                        title: labelToDelete.title
                    }
                });
            } else {
                await db.label.delete({
                    where: { id },
                });
            }

            revalidatePath(`/board/${boardId}`);
            return { success: true };
        } catch (error) {
            return { error: "Failed to delete label." };
        }
    });
