"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DeleteChecklistSchema } from "./schema";

export const deleteChecklist = actionClient
    .schema(DeleteChecklistSchema)
    .action(async ({ parsedInput: { id, boardId } }) => {
        try {
            const checklist = await db.checklist.delete({
                where: { id },
            });
            revalidatePath(`/board/${boardId}`);
            return checklist;
        } catch (error) {
            return { error: "Failed to delete checklist." };
        }
    });
