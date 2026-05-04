"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateLabelSchema } from "./schema";

export const createLabel = actionClient
    .schema(CreateLabelSchema)
    .action(async ({ parsedInput: { cardId, boardId, title, color } }) => {
        try {
            const card = await db.card.findUnique({
                where: { id: cardId },
                select: { syncGroupId: true }
            });

            if (card?.syncGroupId) {
                const syncedCards = await db.card.findMany({
                    where: { syncGroupId: card.syncGroupId },
                    select: { 
                        id: true,
                        labels: {
                            where: { title, color }
                        }
                    }
                });

                const cardsWithoutLabel = syncedCards.filter(c => c.labels.length === 0);

                if (cardsWithoutLabel.length > 0) {
                    await db.label.createMany({
                        data: cardsWithoutLabel.map(c => ({
                            cardId: c.id,
                            title,
                            color
                        }))
                    });
                }
            } else {
                const existing = await db.label.findFirst({
                    where: { cardId, title, color }
                });

                if (!existing) {
                    await db.label.create({
                        data: { cardId, title, color },
                    });
                }
            }
            revalidatePath(`/board/${boardId}`);
            return { success: true };
        } catch (error) {
            throw new Error("Failed to create label.");
        }
    });
