"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { UpdateCardDescriptionSchema } from "./schema";

export const updateCardDescription = actionClient
    .schema(UpdateCardDescriptionSchema)
    .action(async ({ parsedInput: { id, description, boardId } }) => {
        try {
            const existingCard = await db.card.findUnique({
                where: { id },
                select: { syncGroupId: true }
            });

            if (!existingCard) return { error: "Card not found" };

            let card;
            if (existingCard.syncGroupId) {
                await db.card.updateMany({
                    where: { syncGroupId: existingCard.syncGroupId },
                    data: { description },
                });
                card = await db.card.findUnique({ where: { id } });
            } else {
                card = await db.card.update({
                    where: { id },
                    data: { description },
                });
            }

            revalidatePath(`/board/${boardId}`);
            return card;
        } catch (error) {
            return { error: "Failed to update card description." };
        }
    });
