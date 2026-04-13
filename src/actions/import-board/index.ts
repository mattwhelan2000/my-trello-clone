"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { ImportBoardSchema } from "./schema";

import { formatImageUrl } from "@/lib/format-image-url";

export const importBoard = actionClient
    .schema(ImportBoardSchema)
    .action(async ({ parsedInput: boardData }) => {
        try {
            // Check if there is a workspace, otherwise create a default one
            let workspace = await db.workspace.findFirst();

            if (!workspace) {
                workspace = await db.workspace.create({
                    data: {
                        name: "My Workspace",
                        members: ["default_user"],
                    }
                });
            }

            // Create board with nested creates. Notice we omit `id`s so Prisma generates new UUIDs
            const board = await db.board.create({
                data: {
                    title: boardData.title,
                    workspaceId: workspace.id,
                    bgColor: boardData.bgColor,
                    bgImage: formatImageUrl(boardData.bgImage),
                    googleSheetId: boardData.googleSheetId,
                    colorSwatches: boardData.colorSwatches || [],
                    listColorSwatches: boardData.listColorSwatches || [],
                    textColorSwatches: boardData.textColorSwatches || [],
                    lists: {
                        create: boardData.lists.map(list => ({
                            title: list.title,
                            order: list.order,
                            color: list.color,
                            fontColor: list.fontColor,
                            isSyncedWithSheet: list.isSyncedWithSheet ?? true,
                            cards: {
                                create: list.cards.map(card => ({
                                    title: card.title,
                                    description: card.description,
                                    order: card.order,
                                    color: card.color,
                                    fontColor: card.fontColor,
                                    dueDate: card.dueDate ? new Date(card.dueDate) : null,
                                    isSyncedWithSheet: card.isSyncedWithSheet ?? true,
                                    labels: {
                                        create: card.labels?.map(l => ({ title: l.title, color: l.color })) || []
                                    },
                                    checklists: {
                                        create: card.checklists?.map(c => ({
                                            title: c.title,
                                            items: {
                                                create: c.items.map(i => ({
                                                    title: i.title,
                                                    isCompleted: i.isCompleted
                                                }))
                                            }
                                        })) || []
                                    },
                                    attachments: {
                                        create: card.attachments?.map(a => ({
                                            url: a.url,
                                            type: a.type,
                                            title: a.title,
                                            thumbnailUrl: a.thumbnailUrl,
                                            isCover: a.isCover
                                        })) || []
                                    }
                                }))
                            }
                        }))
                    }
                },
            });

            revalidatePath("/");

            return board;
        } catch (error) {
            console.error("IMPORT ERROR", error);
            return { error: "Failed to import board." };
        }
    });
