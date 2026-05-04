"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateSnapshotSchema } from "./schema";

export const createSnapshot = actionClient
    .schema(CreateSnapshotSchema)
    .action(async ({ parsedInput: { boardId, title } }) => {
        try {
            // 1. Fetch current state of all cards on the board
            const cards = await db.card.findMany({
                where: {
                    list: { boardId }
                },
                select: {
                    id: true,
                    isSlim: true,
                    displayThumbnails: true
                }
            });

            if (cards.length === 0) {
                throw new Error("No cards found on this board.");
            }

            // 2. Save as snapshot
            const snapshot = await db.boardSnapshot.create({
                data: {
                    boardId,
                    title,
                    data: cards // Storing as JSON
                }
            });

            revalidatePath(`/board/${boardId}`);
            return { success: true, id: snapshot.id };
        } catch (error) {
            console.error("[CREATE_SNAPSHOT_ERROR]", error);
            throw new Error("Failed to create snapshot.");
        }
    });
