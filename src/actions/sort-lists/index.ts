"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { SortListsSchema } from "./schema";

export const sortLists = actionClient
    .schema(SortListsSchema)
    .action(async ({ parsedInput: { boardId, order } }) => {
        try {
            const lists = await db.list.findMany({
                where: { boardId },
                select: { id: true, title: true }
            });

            // Sort lists alphabetically
            lists.sort((a, b) => {
                const comparison = a.title.localeCompare(b.title);
                return order === "asc" ? comparison : -comparison;
            });

            // Prepare bulk update raw SQL
            if (lists.length === 0) return { success: true };

            const cases = lists.map((list, index) => `WHEN id = '${list.id}' THEN ${index}`).join(' ');
            const ids = lists.map(list => `'${list.id}'`).join(',');

            await db.$executeRawUnsafe(`
                UPDATE "List"
                SET "order" = CASE
                    ${cases}
                END
                WHERE id IN (${ids})
            `);

            revalidatePath(`/board/${boardId}`);
            return { success: true };
        } catch (error) {
            console.error("[SORT_LISTS_ERROR]", error);
            throw new Error("Failed to sort lists.");
        }
    });
