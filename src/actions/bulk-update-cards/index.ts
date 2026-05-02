"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { BulkUpdateCardsSchema } from "./schema";

export const bulkUpdateCards = actionClient
    .schema(BulkUpdateCardsSchema)
    .action(async ({ parsedInput: { boardId, items } }) => {
        try {
            const updates = items.map((item) => 
                db.card.update({
                    where: { id: item.id },
                    data: {
                        ...(item.isSlim !== undefined && { isSlim: item.isSlim }),
                    }
                })
            );

            await db.$transaction(updates);

            revalidatePath(`/board/${boardId}`);
            return { count: items.length };
        } catch (error) {
            console.error("BULK UPDATE ERROR", error);
            return { error: "Failed to perform bulk update." };
        }
    });
