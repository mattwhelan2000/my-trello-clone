"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DeleteAttachmentSchema } from "./schema";

export const deleteAttachment = actionClient
    .schema(DeleteAttachmentSchema)
    .action(async ({ parsedInput: { id, boardId } }) => {
        try {
            const attachmentToDelete = await db.attachment.findUnique({
                where: { id },
                include: { card: { select: { syncGroupId: true } } }
            });

            if (!attachmentToDelete) return { error: "Attachment not found" };

            if (attachmentToDelete.card?.syncGroupId) {
                const syncedCards = await db.card.findMany({
                    where: { syncGroupId: attachmentToDelete.card.syncGroupId },
                    select: { id: true }
                });

                await db.attachment.deleteMany({
                    where: {
                        cardId: { in: syncedCards.map(c => c.id) },
                        url: attachmentToDelete.url
                    }
                });
            } else {
                await db.attachment.delete({
                    where: { id },
                });
            }

            revalidatePath(`/board/${boardId}`);
            return { success: true };
        } catch (error) {
            return { error: "Failed to delete attachment." };
        }
    });
