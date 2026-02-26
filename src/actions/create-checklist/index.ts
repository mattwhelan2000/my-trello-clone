"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateChecklistSchema } from "./schema";

export const createChecklist = actionClient
    .schema(CreateChecklistSchema)
    .action(async ({ parsedInput: { title, cardId, boardId } }) => {
        try {
            const checklist = await db.checklist.create({
                data: {
                    title,
                    cardId,
                },
                include: {
                    items: true,
                },
            });

            revalidatePath(`/board/${boardId}`);
            return checklist;
        } catch (error) {
            return { error: "Failed to create checklist." };
        }
    });
