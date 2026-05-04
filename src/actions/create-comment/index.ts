"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateCommentSchema } from "./schema";

export const createComment = actionClient
    .schema(CreateCommentSchema)
    .action(async ({ parsedInput: { cardId, boardId, action, userId } }) => {
        try {
            const activity = await db.activity.create({
                data: {
                    cardId,
                    userId: userId || "user",
                    action,
                },
            });
            revalidatePath(`/board/${boardId}`);
            return activity;
        } catch (error) {
            throw new Error("Failed to create comment.");
        }
    });
