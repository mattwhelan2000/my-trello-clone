"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { UpdateChecklistItemSchema } from "./schema";

export const updateChecklistItem = actionClient
    .schema(UpdateChecklistItemSchema)
    .action(async ({ parsedInput: { id, boardId, isCompleted } }) => {
        try {
            const checklistItem = await db.checklistItem.update({
                where: { id },
                data: { isCompleted },
            });
            revalidatePath(`/board/${boardId}`);
            return checklistItem;
        } catch (error) {
            throw new Error("Failed to update checklist item.");
        }
    });
