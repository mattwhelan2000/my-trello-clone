"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { UpdateCardSchema } from "./schema";

export const updateCard = actionClient
    .schema(UpdateCardSchema)
    .action(async ({ parsedInput: { id, title, boardId, color, fontColor, dueDate } }) => {
        try {
            const card = await db.card.update({
                where: { id },
                data: {
                    title,
                    ... (color !== undefined && { color }),
                    ... (fontColor !== undefined && { fontColor }),
                    ... (dueDate !== undefined && { dueDate }),
                },
            });

            revalidatePath(`/board/${boardId}`);
            return card;
        } catch (error) {
            return { error: "Failed to update card." };
        }
    });
