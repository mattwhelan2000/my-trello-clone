"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { UpdateCardSchema } from "./schema";

export const updateCard = actionClient
    .schema(UpdateCardSchema)
    .action(async ({ parsedInput: { id, title, description, boardId, color, fontColor, dueDate } }) => {
        try {
            const existingCard = await db.card.findUnique({
                where: { id },
                select: { syncGroupId: true }
            });

            if (!existingCard) return { error: "Card not found" };

            const dataToUpdate = {
                ...(title !== undefined && { title }),
                ...(description !== undefined && { description }),
                ...(color !== undefined && { color }),
                ...(fontColor !== undefined && { fontColor }),
                ...(dueDate !== undefined && { dueDate }),
                isSyncedWithSheet: false, // Break the link!
            };

            let card;
            if (existingCard.syncGroupId) {
                // Update all synced cards
                await db.card.updateMany({
                    where: { syncGroupId: existingCard.syncGroupId },
                    data: dataToUpdate,
                });
                // Fetch the updated card to return
                card = await db.card.findUnique({ where: { id } });
            } else {
                card = await db.card.update({
                    where: { id },
                    data: dataToUpdate,
                });
            }

            revalidatePath(`/board/${boardId}`);
            return card;
        } catch (error) {
            return { error: "Failed to update card." };
        }
    });
