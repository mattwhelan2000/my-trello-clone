"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { UpdateAttachmentSchema } from "./schema";

export const updateAttachment = actionClient
    .schema(UpdateAttachmentSchema)
    .action(async ({ parsedInput: { id, boardId, title } }) => {
        try {
            const attachment = await db.attachment.update({
                where: { id },
                data: { title }
            });

            revalidatePath(`/board/${boardId}`);
            return attachment;
        } catch (error) {
            console.error("[UPDATE_ATTACHMENT_ERROR]", error);
            throw new Error("Failed to update attachment title.");
        }
    });
