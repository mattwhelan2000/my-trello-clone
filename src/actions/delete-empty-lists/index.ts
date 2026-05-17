"use server";

import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const DeleteEmptyListsSchema = z.object({
    boardId: z.string(),
});

export const deleteEmptyLists = actionClient
    .schema(DeleteEmptyListsSchema)
    .action(async ({ parsedInput: { boardId } }) => {
        const emptyLists = await db.list.findMany({
            where: {
                boardId,
                cards: {
                    none: {}
                }
            },
            select: {
                id: true
            }
        });

        if (emptyLists.length === 0) {
            return { success: true, count: 0 };
        }

        const deleted = await db.list.deleteMany({
            where: {
                id: {
                    in: emptyLists.map(l => l.id)
                }
            }
        });

        revalidatePath(`/board/${boardId}`);
        return { success: true, count: deleted.count };
    });
