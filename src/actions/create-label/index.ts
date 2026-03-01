"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateLabelSchema } from "./schema";

export const createLabel = actionClient
    .schema(CreateLabelSchema)
    .action(async ({ parsedInput: { cardId, boardId, title, color } }) => {
        try {
            const label = await db.label.create({
                data: { cardId, title, color },
            });
            revalidatePath(`/board/${boardId}`);
            return label;
        } catch (error) {
            return { error: "Failed to create label." };
        }
    });
