"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DeleteCardSchema } from "./schema";

export const deleteCard = actionClient
    .schema(DeleteCardSchema)
    .action(async ({ parsedInput: { id, boardId } }) => {
        try {
            const card = await db.card.delete({
                where: { id },
            });
            revalidatePath(`/board/${boardId}`);
            return card;
        } catch (error) {
            throw new Error("Failed to delete card.");
        }
    });
