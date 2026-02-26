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
                                        include: {
                                            items: {
                                                orderBy: { createdAt: "asc" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (!board) {
                return { error: "Board not found" };
            }

            return board;
        } catch (error) {
            return { error: "Failed to export board." };
        }
    });
