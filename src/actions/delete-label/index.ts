"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DeleteLabelSchema } from "./schema";

export const deleteLabel = actionClient
    .schema(DeleteLabelSchema)
    .action(async ({ parsedInput: { id, boardId } }) => {
        try {
            const label = await db.label.delete({
                where: { id },
            });
            revalidatePath(`/board/${boardId}`);
            return label;
        } catch (error) {
            return { error: "Failed to delete label." };
        }
    });
