"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DecloneCardSchema } from "./schema";

export const decloneCard = actionClient
    .schema(DecloneCardSchema)
    .action(async ({ parsedInput: { id, boardId } }) => {
        try {
            const cardToDeclone = await db.card.findUnique({
                where: { id },
                select: { syncGroupId: true }
            });

            if (!cardToDeclone || !cardToDeclone.syncGroupId) {
                throw new Error("Card is not cloned. Cannot declone.");
            }

            const card = await db.card.update({
                where: { id },
                data: { syncGroupId: null }
            });

            // Also check if there's only 1 card left in the sync group and declone it as well to clean up? Or leave it as is. Leaving as is is fine.

            revalidatePath(`/board/${boardId}`);
            return card;
        } catch (error) {
            throw new Error("Failed to declone card.");
        }
    });
