"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { MoveCardSchema } from "./schema";

export const moveCard = actionClient
    .schema(MoveCardSchema)
    .action(async ({ parsedInput: { cardId, targetListId, boardId } }) => {
        try {
            // Verify that the target list exists and belongs to the board
            const targetList = await db.list.findUnique({
                where: { id: targetListId, boardId },
            });

            if (!targetList) {
                throw new Error("Target list not found on this board.");
            }

            // Get the last card order in target list
            const lastCard = await db.card.findFirst({
                where: { listId: targetListId },
                orderBy: { order: "desc" },
                select: { order: true },
            });

            const newOrder = lastCard ? lastCard.order + 1 : 0;

            const card = await db.card.update({
                where: { id: cardId },
                data: {
                    listId: targetListId,
                    order: newOrder,
                },
            });

            revalidatePath(`/board/${boardId}`);
            return card;
        } catch (error) {
            throw new Error("Failed to move card.");
        }
    });
