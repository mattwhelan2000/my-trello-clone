"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateListSchema } from "./schema";

export const createList = actionClient
    .schema(CreateListSchema)
    .action(async ({ parsedInput: { title, boardId } }) => {
        try {
            const board = await db.board.findUnique({
                where: { id: boardId },
            });

            if (!board) {
                return { error: "Board not found" };
            }

            const lastList = await db.list.findFirst({
                where: { boardId },
                orderBy: { order: "desc" },
                select: { order: true },
            });

            const newOrder = lastList ? lastList.order + 1 : 0;

            const list = await db.list.create({
                data: {
                    title,
                    boardId,
                    order: newOrder,
                },
            });

            revalidatePath(`/board/${boardId}`);
            return list;
        } catch (error) {
            return { error: "Failed to create list." };
        }
    });
