"use server";

import { revalidatePath } from "next/cache";
import { actionClient } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { UpdateListColors } from "./schema";

export const updateListColors = actionClient
    .schema(UpdateListColors)
    .action(async ({ parsedInput: { boardId, color } }) => {
        try {
            const updatedLists = await db.list.updateMany({
                where: { boardId },
                data: { color },
            });

            revalidatePath(`/board/${boardId}`);
            return { count: updatedLists.count };
        } catch (error) {
            return { error: "Failed to update list colors." };
        }
    });
