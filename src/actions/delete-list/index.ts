"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DeleteListSchema } from "./schema";

export const deleteList = actionClient
    .schema(DeleteListSchema)
    .action(async ({ parsedInput: { id, boardId } }) => {
        try {
            const list = await db.list.delete({
                where: { id, boardId },
            });
            revalidatePath(`/board/${boardId}`);
            return list;
        } catch (error) {
            throw new Error("Failed to delete list.");
        }
    });
