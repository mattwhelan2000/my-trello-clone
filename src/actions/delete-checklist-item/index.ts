"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DeleteChecklistItemSchema } from "./schema";

export const deleteChecklistItem = actionClient
    .schema(DeleteChecklistItemSchema)
    .action(async ({ parsedInput: { id, boardId } }) => {
        try {
            const checklistItem = await db.checklistItem.delete({
                where: { id },
            });
            revalidatePath(`/board/${boardId}`);
            return checklistItem;
        } catch (error) {
            return { error: "Failed to delete checklist item." };
        }
    });
