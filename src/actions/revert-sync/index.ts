"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { RevertSyncSchema } from "./schema";

export const revertSync = actionClient
    .schema(RevertSyncSchema)
    .action(async ({ parsedInput: { boardId } }) => {
        try {
            // Find most recent sync backup
            const snapshot = await db.boardSnapshot.findFirst({
                where: { boardId, title: { startsWith: "SYNC_BACKUP_" } },
                orderBy: { createdAt: "desc" }
            });

            if (!snapshot) throw new Error("No sync backup found to revert to.");

            const data = snapshot.data as any;
            const backupLists = data.lists || [];
            const backupCards = data.cards || [];
            const backupLabels = data.labels || [];

            const backupListIds = backupLists.map((l: any) => l.id);
            const backupCardIds = backupCards.map((c: any) => c.id);
            const backupLabelIds = backupLabels.map((l: any) => l.id);

            // 1. Delete anything that was created SINCE the backup
            if (backupLabelIds.length > 0) {
                await db.label.deleteMany({
                    where: { card: { list: { boardId } }, id: { notIn: backupLabelIds } }
                });
            }
            if (backupCardIds.length > 0) {
                await db.card.deleteMany({
                    where: { list: { boardId }, id: { notIn: backupCardIds } }
                });
            }
            if (backupListIds.length > 0) {
                await db.list.deleteMany({
                    where: { boardId, id: { notIn: backupListIds } }
                });
            }

            // 2. Restore all Lists
            for (const bl of backupLists) {
                await db.list.updateMany({
                    where: { id: bl.id },
                    data: { title: bl.title, order: bl.order }
                });
            }

            // 3. Restore all Cards
            for (const bc of backupCards) {
                await db.card.updateMany({
                    where: { id: bc.id },
                    data: {
                        title: bc.title,
                        description: bc.description,
                        order: bc.order,
                        color: bc.color,
                        isSyncedWithSheet: bc.isSyncedWithSheet,
                        shotCount: bc.shotCount,
                        vfxAssetNumbers: bc.vfxAssetNumbers,
                        listId: bc.listId
                    }
                });
            }

            // 4. Restore Labels
            for (const bl of backupLabels) {
                await db.label.updateMany({
                    where: { id: bl.id },
                    data: { title: bl.title, color: bl.color, cardId: bl.cardId }
                });
            }

            // Clean up old backup if it was successful (optional)
            await db.boardSnapshot.delete({ where: { id: snapshot.id } });

            revalidatePath(`/board/${boardId}`);
            return { success: true };
        } catch (error: any) {
            console.error("[REVERT_SYNC_ERROR]", error);
            throw new Error(error.message || "Failed to revert sync.");
        }
    });
