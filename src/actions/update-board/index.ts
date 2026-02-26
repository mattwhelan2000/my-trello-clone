"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { UpdateBoardSchema } from "./schema";

export const updateBoard = actionClient
    .schema(UpdateBoardSchema)
    .action(async ({ parsedInput: { id, bgImage, bgColor } }) => {
        try {
            const board = await db.board.update({
                where: { id },
                data: { bgImage, bgColor },
            });

            revalidatePath(`/board/${board.id}`);
            return board;
        } catch (error) {
            return { error: "Failed to update board background." };
        }
    });
