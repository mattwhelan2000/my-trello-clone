"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DeleteLabelBatchSchema } from "./schema";

export const deleteLabelBatch = actionClient
    .schema(DeleteLabelBatchSchema)
    .action(async ({ parsedInput: { boardId, labelTitle } }) => {
        try {
            console.log(`[DeleteLabelBatch] Deleting label '${labelTitle}' from board ${boardId}`);

            await db.label.deleteMany({
                where: {
                    title: labelTitle,
                    card: {
                        list: {
                            boardId: boardId
                        }
                    }
                }
            });

            revalidatePath(`/board/${boardId}`);
            revalidatePath(`/(platform)/board/${boardId}`, "layout");
            
            return { success: true };
        } catch (error: any) {
            console.error("[DeleteLabelBatch] Error:", error);
            return { error: "Failed to delete label." };
        }
    });
