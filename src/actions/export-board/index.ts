"use server";

import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { ExportBoardSchema } from "./schema";

export const exportBoard = actionClient
    .schema(ExportBoardSchema)
    .action(async ({ parsedInput: { id } }) => {
        try {
            const board = await db.board.findUnique({
                where: { id },
                include: {
                    lists: {
                        orderBy: { order: "asc" },
                        include: {
                            cards: {
                                orderBy: { order: "asc" },
                                include: {
                                    attachments: true,
                                    labels: true,
                                    checklists: {
                                        orderBy: { createdAt: "asc" },
                                        include: {
                                            items: {
                                                orderBy: { createdAt: "asc" }
                                            }
                                        }
                                    },
                                    activities: true
                                }
                            }
                        }
                    }
                }
            });

            if (!board) {
                throw new Error("Board not found");
            }

            return board;
        } catch (error) {
            throw new Error("Failed to export board.");
        }
    });
