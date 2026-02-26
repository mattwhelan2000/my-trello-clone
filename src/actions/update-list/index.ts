"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { UpdateListSchema } from "./schema";

export const updateList = actionClient
    .schema(UpdateListSchema)
    .action(async ({ parsedInput: { id, title, boardId, color } }) => {
        try {
            const list = await db.list.update({
                where: { id, boardId },
                data: { title, color },
            });

            revalidatePath(`/board/${boardId}`);
            return list;
        } catch (error) {
            return { error: "Failed to update list." };
        }
    });
