"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DeleteBoardSchema } from "./schema";

export const deleteBoard = actionClient
    .schema(DeleteBoardSchema)
    .action(async ({ parsedInput: { id } }) => {
        try {
            const board = await db.board.delete({
                where: { id },
            });
            revalidatePath("/");
            return board;
        } catch (error) {
            return { error: "Failed to delete board." };
        }
    });
