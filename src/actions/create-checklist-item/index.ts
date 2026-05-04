"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateChecklistItemSchema } from "./schema";

export const createChecklistItem = actionClient
    .schema(CreateChecklistItemSchema)
    .action(async ({ parsedInput: { title, checklistId, boardId } }) => {
        try {
            const item = await db.checklistItem.create({
                data: {
                    title,
                    checklistId,
                },
            });

            revalidatePath(`/board/${boardId}`);
            return item;
        } catch (error) {
            throw new Error("Failed to create checklist item.");
        }
    });
