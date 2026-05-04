"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { UpdateLabelBatchSchema } from "./schema";

export const updateLabelBatch = actionClient
    .schema(UpdateLabelBatchSchema)
    .action(async ({ parsedInput: { boardId, oldTitle, newTitle, newColor } }) => {
        try {
            console.log(`[UpdateLabelBatch] Updating label '${oldTitle}' to '${newTitle}' with color ${newColor} on board ${boardId}`);

            await db.label.updateMany({
                where: {
                    title: oldTitle,
                    card: {
                        list: {
                            boardId: boardId
                        }
                    }
                },
                data: {
                    title: newTitle,
                    color: newColor
                }
            });

            revalidatePath(`/board/${boardId}`);
            revalidatePath(`/(platform)/board/${boardId}`, "layout");
            
            return { success: true };
        } catch (error: any) {
            console.error("[UpdateLabelBatch] Error:", error);
            throw new Error("Failed to update label.");
        }
    });
