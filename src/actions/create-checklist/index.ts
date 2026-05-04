"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateChecklistSchema } from "./schema";

export const createChecklist = actionClient
    .schema(CreateChecklistSchema)
    .action(async ({ parsedInput: { title, cardId, boardId } }) => {
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

                for (const c of syncedCards) {
                    await db.checklist.create({
                        data: { title, cardId: c.id },
                    });
                }
            } else {
                await db.checklist.create({
                    data: { title, cardId },
                });
            }

            revalidatePath(`/board/${boardId}`);
            return { success: true };
        } catch (error) {
            throw new Error("Failed to create checklist.");
        }
    });
