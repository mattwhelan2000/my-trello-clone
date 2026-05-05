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

            if (snapshotData.length === 0) {
                throw new Error("Snapshot is empty.");
            }

            // 2. Build efficient bulk update using raw SQL with CASE expressions
            // This replaces ~N individual updateMany calls with a single query
            const ids = snapshotData.map((item: any) => item.id);
            
            let slimCases = "";
            let thumbCases = "";
            let modeCases = "";
            
            for (const item of snapshotData) {
                const escapedId = item.id.replace(/'/g, "''");
                slimCases += `WHEN id = '${escapedId}' THEN ${item.isSlim ? 'true' : 'false'} `;
                thumbCases += `WHEN id = '${escapedId}' THEN ${item.displayThumbnails !== false ? 'true' : 'false'} `;
                if (item.thumbnailMode) {
                    modeCases += `WHEN id = '${escapedId}' THEN '${item.thumbnailMode === 'contain' ? 'contain' : 'cover'}' `;
                }
            }
            
            const idList = ids.map((id: string) => `'${id.replace(/'/g, "''")}'`).join(",");
            
            let sql = `UPDATE "Card" SET 
                "isSlim" = CASE ${slimCases} ELSE "isSlim" END,
                "displayThumbnails" = CASE ${thumbCases} ELSE "displayThumbnails" END`;
            
            if (modeCases) {
                sql += `,
                "thumbnailMode" = CASE ${modeCases} ELSE "thumbnailMode" END`;
            }
            
            sql += `
                WHERE id IN (${idList})`;
            
            await db.$executeRawUnsafe(sql);

            revalidatePath(`/board/${boardId}`);
            return { success: true, count: snapshotData.length };
        } catch (error) {
            console.error("[APPLY_SNAPSHOT_ERROR]", error);
            throw new Error("Failed to apply snapshot.");
        }
    });
