"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { UpdateAttachmentCoverSchema } from "./schema";

export const updateAttachmentCover = actionClient
    .schema(UpdateAttachmentCoverSchema)
    .action(async ({ parsedInput: { id, cardId, boardId } }) => {
        try {
            // First, remove cover from all attachments on this card
            await db.attachment.updateMany({
                where: { cardId },
                data: { isCover: false },
            });

            // Then set cover on the selected attachment
            const attachment = await db.attachment.update({
                where: { id },
                data: { isCover: true },
            });

            revalidatePath(`/board/${boardId}`);
            return attachment;
        } catch (error) {
            throw new Error("Failed to update attachment cover.");
        }
    });
