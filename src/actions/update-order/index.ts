"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { UpdateListOrderSchema, UpdateCardOrderSchema } from "./schema";

export const updateListOrder = actionClient
    .schema(UpdateListOrderSchema)
    .action(async ({ parsedInput: { items, boardId } }) => {
        try {
            console.log(`[updateListOrder] Reordering ${items.length} lists on board ${boardId}`);
            
            if (items.length === 0) return { data: items };

            console.log(`[updateListOrder] Reordering ${items.length} lists on board ${boardId} via raw SQL`);
            
            const cases = items.map(item => `WHEN id = '${item.id}' THEN ${item.order}`).join(' ');
            const ids = items.map(item => `'${item.id}'`).join(',');
            
            await db.$executeRawUnsafe(`
                UPDATE "List"
                SET "order" = CASE
                    ${cases}
                END
                WHERE id IN (${ids})
            `);

            console.log(`[updateListOrder] Transaction complete for board ${boardId}`);

            revalidatePath(`/board/${boardId}`);
            revalidatePath(`/(platform)/board/${boardId}`, "layout");
            revalidatePath(`/(platform)/board/${boardId}`, "page");
            
            return { data: items };
        } catch (error) {
            console.error("[updateListOrder] Error:", error);
            throw new Error("Failed to reorder lists.");
        }
    });

export const updateCardOrder = actionClient
    .schema(UpdateCardOrderSchema)
    .action(async ({ parsedInput: { items, boardId } }) => {
        try {
            if (items.length === 0) return { data: items };

            console.log(`[ACTION] updateCardOrder: Updating ${items.length} cards for board ${boardId} via raw SQL`);
            
            const orderCases = items.map(item => `WHEN id = '${item.id}' THEN ${item.order}`).join(' ');
            const listCases = items.map(item => `WHEN id = '${item.id}' THEN '${item.listId}'`).join(' ');
            const ids = items.map(item => `'${item.id}'`).join(',');

            await db.$executeRawUnsafe(`
                UPDATE "Card"
                SET 
                    "order" = CASE ${orderCases} END,
                    "listId" = CASE ${listCases} END
                WHERE id IN (${ids})
            `);

            revalidatePath(`/board/${boardId}`);
            return { data: items };
        } catch (error) {
            console.error(`[ACTION] updateCardOrder Error:`, error);
            throw new Error("Failed to reorder cards.");
        }
    });
