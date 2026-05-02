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
            
            await db.$transaction(async (tx) => {
                // Pass 1: Move to high temporary orders to avoid any potential collisions
                for (let i = 0; i < items.length; i++) {
                    await tx.list.update({
                        where: { id: items[i].id, boardId },
                        data: { order: 10000 + i }
                    });
                }

                // Pass 2: Final order
                for (let i = 0; i < items.length; i++) {
                    await tx.list.update({
                        where: { id: items[i].id, boardId },
                        data: { order: items[i].order }
                    });
                }
            });

            revalidatePath(`/board/${boardId}`);
            return { data: items };
        } catch (error) {
            console.error("[updateListOrder] Error:", error);
            return { error: "Failed to reorder lists." };
        }
    });

export const updateCardOrder = actionClient
    .schema(UpdateCardOrderSchema)
    .action(async ({ parsedInput: { items, boardId } }) => {
        try {
            console.log(`[ACTION] updateCardOrder: Updating ${items.length} cards for board ${boardId}`);
            
            await db.$transaction(async (tx) => {
                // Pass 1: Temp positions
                for (let i = 0; i < items.length; i++) {
                    await tx.card.update({
                        where: { id: items[i].id },
                        data: { order: 50000 + i }
                    });
                }

                // Pass 2: Final positions
                for (let i = 0; i < items.length; i++) {
                    await tx.card.update({
                        where: { id: items[i].id },
                        data: {
                            order: items[i].order,
                            listId: items[i].listId,
                        }
                    });
                }
            });

            revalidatePath(`/board/${boardId}`);
            return { data: items };
        } catch (error) {
            console.error(`[ACTION] updateCardOrder Error:`, error);
            return { error: "Failed to reorder cards." };
        }
    });
