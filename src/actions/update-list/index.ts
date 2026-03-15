"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { UpdateListSchema } from "./schema";

export const updateList = actionClient
    .schema(UpdateListSchema)
    .action(async ({ parsedInput: { id, title, boardId, color, fontColor } }) => {
        try {
            const updateData: any = { isSyncedWithSheet: false }; // Break the link!
            if (title !== undefined) updateData.title = title;
            if (color !== undefined) updateData.color = color;
            if (fontColor !== undefined) updateData.fontColor = fontColor;

            const list = await db.list.update({
                where: { id, boardId },
                data: updateData,
            });

            revalidatePath(`/board/${boardId}`);
            return list;
        } catch (error) {
            return { error: "Failed to update list." };
        }
    });
