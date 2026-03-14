"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { UpdateBoardSchema } from "./schema";

import { formatImageUrl } from "@/lib/format-image-url";

export const updateBoard = actionClient
    .schema(UpdateBoardSchema)
    .action(async ({ parsedInput: { id, title, bgImage, bgColor, googleSheetId } }) => {
        try {
            const formattedBgImage = formatImageUrl(bgImage);

            // only include fields that are passed in (undefined won't overwrite existing db fields)
            const updateData: any = { title, bgImage: formattedBgImage, bgColor };
            if (googleSheetId !== undefined) {
                updateData.googleSheetId = googleSheetId;
            }

            const board = await db.board.update({
                where: { id },
                data: updateData,
            });

            revalidatePath(`/board/${board.id}`);
            revalidatePath(`/`); // Revalidate dashboard list as well
            return board;
        } catch (error) {
            return { error: "Failed to update board background." };
        }
    });
