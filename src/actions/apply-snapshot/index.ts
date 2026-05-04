"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { ApplySnapshotSchema } from "./schema";

export const applySnapshot = actionClient
    .schema(ApplySnapshotSchema)
    .action(async ({ parsedInput: { boardId, snapshotId } }) => {
        try {
            // 1. Fetch snapshot
            const snapshot = await db.boardSnapshot.findUnique({
                where: { id: snapshotId }
            });

            if (!snapshot) {
                throw new Error("Snapshot not found.");
            }

            const snapshotData = snapshot.data as any[];

            // 2. Perform bulk update
            // We use a transaction for all updates
            const updates = snapshotData.map((item: any) => 
                db.card.updateMany({
                    where: { id: item.id },
                    data: {
                        isSlim: item.isSlim,
                        displayThumbnails: item.displayThumbnails
                    }
                })
            );

            await db.$transaction(updates);

            revalidatePath(`/board/${boardId}`);
            return { success: true, count: snapshotData.length };
        } catch (error) {
            console.error("[APPLY_SNAPSHOT_ERROR]", error);
            throw new Error("Failed to apply snapshot.");
        }
    });
