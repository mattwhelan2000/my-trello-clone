"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DeleteAttachmentSchema } from "./schema";

export const deleteAttachment = actionClient
    .schema(DeleteAttachmentSchema)
    .action(async ({ parsedInput: { id, boardId } }) => {
        try {
            const attachment = await db.attachment.delete({
                where: { id },
            });
            revalidatePath(`/board/${boardId}`);
            return attachment;
        } catch (error) {
            return { error: "Failed to delete attachment." };
        }
    });
