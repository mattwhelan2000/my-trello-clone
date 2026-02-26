"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { UpdateListOrderSchema, UpdateCardOrderSchema } from "./schema";

export const updateListOrder = actionClient
    .schema(UpdateListOrderSchema)
    .action(async ({ parsedInput: { items, boardId } }) => {
        try {
            const transaction = items.map((list) =>
                db.list.update({
                    where: {
                        id: list.id,
                        boardId,
                    },
                    data: {
                        order: list.order,
                    },
                })
            );

            await db.$transaction(transaction);

            revalidatePath(`/board/${boardId}`);
            return { data: items };
        } catch (error) {
            return { error: "Failed to reorder lists." };
        }
    });

export const updateCardOrder = actionClient
    .schema(UpdateCardOrderSchema)
    .action(async ({ parsedInput: { items, boardId } }) => {
        try {
            const transaction = items.map((card) =>
                db.card.update({
                    where: {
                        id: card.id,
                    },
                    data: {
                        order: card.order,
                        listId: card.listId,
                    },
                })
            );

            await db.$transaction(transaction);

            revalidatePath(`/board/${boardId}`);
            return { data: items };
        } catch (error) {
            return { error: "Failed to reorder cards." };
        }
    });
