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
                    select: { id: true }
                });

                await db.label.createMany({
                    data: syncedCards.map(c => ({
                        cardId: c.id,
                        title,
                        color
                    })),
                    skipDuplicates: true
                });
            } else {
                await db.label.create({
                    data: { cardId, title, color },
                });
            }
            revalidatePath(`/board/${boardId}`);
            return { success: true };
        } catch (error) {
            return { error: "Failed to create label." };
        }
    });
