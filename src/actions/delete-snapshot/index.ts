"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DeleteSnapshotSchema } from "./schema";

export const deleteSnapshot = actionClient
    .schema(DeleteSnapshotSchema)
    .action(async ({ parsedInput: { boardId, snapshotId } }) => {
        try {
            await db.boardSnapshot.delete({
                where: { id: snapshotId }
            });

            revalidatePath(`/board/${boardId}`);
            return { success: true };
        } catch (error) {
            console.error("[DELETE_SNAPSHOT_ERROR]", error);
            throw new Error("Failed to delete snapshot.");
        }
    });
