"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CopyListSchema } from "./schema";

export const copyList = actionClient
    .schema(CopyListSchema)
    .action(async ({ parsedInput: { id, boardId } }) => {
        try {
            const listToCopy = await db.list.findUnique({
                where: { id, boardId },
                include: { cards: { include: { attachments: true } } },
            });
            if (!listToCopy) return { error: "List not found" };

            const newOrder = listToCopy.order + 1;

            // Increment the order of all lists that come after the copied list
            await db.list.updateMany({
                where: {
                    boardId,
                    order: { gte: newOrder }
                },
                data: {
                    order: { increment: 1 }
                }
            });

            const list = await db.list.create({
                data: {
                    boardId: listToCopy.boardId,
                    title: `${listToCopy.title} - Copy`,
                    order: newOrder,
                    color: listToCopy.color,
                    cards: {
                        create: listToCopy.cards.map((card) => ({
                            title: card.title,
                            description: card.description,
                            order: card.order,
                            dueDate: card.dueDate,
                            attachments: {
                                createMany: {
                                    data: card.attachments.map((att: any) => ({
                                        url: att.url,
                                        type: att.type,
                                        title: att.title,
                                        thumbnailUrl: att.thumbnailUrl,
                                    }))
                                }
                            }
                        })),
                    },
                },
                include: { cards: true },
            });

            revalidatePath(`/board/${boardId}`);
            return list;
        } catch (error) {
            return { error: "Failed to copy list." };
        }
    });
