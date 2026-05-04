"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DeleteCardsSchema } from "./schema";

export const deleteCards = actionClient
    .schema(DeleteCardsSchema)
    .action(async ({ parsedInput: { ids, boardId } }) => {
        try {
            console.log(`[DeleteCards] Request to delete ${ids.length} cards on board ${boardId}`);
            if (ids.length === 0) return { success: true, count: 0 };

            // Explicitly delete in order to satisfy foreign key constraints if they exist
            // Using a transaction for speed and atomicity
            await db.$transaction(async (tx) => {
                // 1. Delete attachments
                await tx.attachment.deleteMany({
                    where: { cardId: { in: ids } }
                });

                // 2. Delete activities (comments)
                await tx.activity.deleteMany({
                    where: { cardId: { in: ids } }
                });

                // 3. Delete Checklist Items
                // Note: ChecklistItem in Prisma is typically accessed via checklistItem
                // We check if the model exists before calling
                if ((tx as any).checklistItem) {
                    await (tx as any).checklistItem.deleteMany({
                        where: { checklist: { cardId: { in: ids } } }
                    });
                }

                // 4. Delete Checklists
                await tx.checklist.deleteMany({
                    where: { cardId: { in: ids } }
                });

                // 5. Finally, delete the cards
                const result = await tx.card.deleteMany({
                    where: { id: { in: ids } }
                });
                
                console.log(`[DeleteCards] Successfully deleted ${result.count} cards.`);
            });

            revalidatePath(`/board/${boardId}`);
            return { success: true, count: ids.length };
        } catch (error: any) {
            console.error("[DeleteCards] Error:", error);
            // Fallback for foreign key issues: just try to delete the cards directly
            // if the complex transaction fails.
            try {
                const result = await db.card.deleteMany({
                    where: { id: { in: ids } }
                });
                revalidatePath(`/board/${boardId}`);
                return { success: true, count: result.count };
            } catch (innerError: any) {
                console.error("[DeleteCards] Fallback Error:", innerError);
                throw new Error("Failed to delete cards. Some cards might have dependencies.");
            }
        }
    });
