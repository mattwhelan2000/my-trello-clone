"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { SortCardsSchema } from "./schema";

export const sortCards = actionClient
    .schema(SortCardsSchema)
    .action(async ({ parsedInput: { boardId, listId, order } }) => {
        try {
            const cards = await db.card.findMany({
                where: { listId },
                select: { id: true, title: true }
            });

            // Sort cards alphabetically
            cards.sort((a, b) => {
                const comparison = a.title.localeCompare(b.title);
                return order === "asc" ? comparison : -comparison;
            });

            if (cards.length === 0) return { success: true };

            const cases = cards.map((card, index) => `WHEN id = '${card.id}' THEN ${index}`).join(' ');
            const ids = cards.map(card => `'${card.id}'`).join(',');

            await db.$executeRawUnsafe(`
                UPDATE "Card"
                SET "order" = CASE
                    ${cases}
                END
                WHERE id IN (${ids})
            `);

            revalidatePath(`/board/${boardId}`);
            return { success: true };
        } catch (error) {
            console.error("[SORT_CARDS_ERROR]", error);
            throw new Error("Failed to sort cards.");
        }
    });
