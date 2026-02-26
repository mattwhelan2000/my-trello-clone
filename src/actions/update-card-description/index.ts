"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { UpdateCardDescriptionSchema } from "./schema";

export const updateCardDescription = actionClient
    .schema(UpdateCardDescriptionSchema)
    .action(async ({ parsedInput: { id, description, boardId } }) => {
        try {
            const card = await db.card.update({
                where: { id },
                data: { description },
            });

            revalidatePath(`/board/${boardId}`);
            return card;
        } catch (error) {
            return { error: "Failed to update card description." };
        }
    });
