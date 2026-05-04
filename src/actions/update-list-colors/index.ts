"use server";

import { revalidatePath } from "next/cache";
import { actionClient } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { UpdateListColors } from "./schema";

export const updateListColors = actionClient
    .schema(UpdateListColors)
    .action(async ({ parsedInput: { boardId, color, listIds } }) => {
        try {
            const whereClause: any = { boardId };
            
            if (listIds && listIds.length > 0) {
                whereClause.id = { in: listIds };
            }

            const updatedLists = await db.list.updateMany({
                where: whereClause,
                data: { color },
            });

            revalidatePath(`/board/${boardId}`);
            return { count: updatedLists.count };
        } catch (error) {
            throw new Error("Failed to update list colors.");
        }
    });
