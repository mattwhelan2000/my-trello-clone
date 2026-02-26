"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { PasteListSchema } from "./schema";

export const pasteList = actionClient
    .schema(PasteListSchema)
    .action(async ({ parsedInput: { sourceListId, boardId } }) => {
        try {
            const listToCopy = await db.list.findUnique({
                where: { id: sourceListId },
                include: { cards: { include: { attachments: true } } },
            });
            if (!listToCopy) return { error: "Source list not found" };

            const lastList = await db.list.findFirst({
                where: { boardId },
                orderBy: { order: "desc" },
                select: { order: true },
            });
            const newOrder = lastList ? lastList.order + 1 : 0;

            const list = await db.list.create({
                data: {
                    boardId: boardId,
                    title: listToCopy.title,
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
            return { error: "Failed to paste list." };
        }
    });
