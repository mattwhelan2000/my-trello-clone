"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CopyListSchema } from "./schema";

export const copyList = actionClient
    .schema(CopyListSchema)
    .action(async ({ parsedInput: { id, boardId } }) => {
        try {
            // Fetch list + cards + attachments in one query
            const listToCopy = await db.list.findUnique({
                where: { id, boardId },
                include: {
                    cards: {
                        include: { attachments: true },
                        orderBy: { order: "asc" },
                    }
                },
            });
            if (!listToCopy) throw new Error("List not found");

            const newOrder = listToCopy.order + 1;

            // Run everything in a single transaction for speed + atomicity
            const list = await db.$transaction(async (tx) => {
                // Shift subsequent lists' order
                await tx.list.updateMany({
                    where: { boardId, order: { gte: newOrder } },
                    data: { order: { increment: 1 } },
                });

                // Create the new list shell first
                const newList = await tx.list.create({
                    data: {
                        boardId: listToCopy.boardId,
                        title: `${listToCopy.title} - Copy`,
                        order: newOrder,
                        color: listToCopy.color,
                    },
                });

                if (listToCopy.cards.length > 0) {
                    // Bulk-create all cards at once
                    await tx.card.createMany({
                        data: listToCopy.cards.map((card) => ({
                            title: card.title,
                            description: card.description,
                            order: card.order,
                            dueDate: card.dueDate,
                            color: card.color,
                            fontColor: card.fontColor,
                            listId: newList.id,
                        })),
                    });

                    // Fetch newly created cards to map attachments
                    const newCards = await tx.card.findMany({
                        where: { listId: newList.id },
                        orderBy: { order: "asc" },
                    });

                    // Collect all attachments across all cards
                    const attachmentsToCreate: {
                        url: string; type: string; title: string | null;
                        thumbnailUrl: string | null; isCover: boolean; cardId: string;
                    }[] = [];

                    listToCopy.cards.forEach((srcCard, i) => {
                        const destCard = newCards[i];
                        if (!destCard) return;
                        srcCard.attachments.forEach((att) => {
                            attachmentsToCreate.push({
                                url: att.url,
                                type: att.type,
                                title: att.title,
                                thumbnailUrl: att.thumbnailUrl,
                                isCover: att.isCover,
                                cardId: destCard.id,
                            });
                        });
                    });

                    if (attachmentsToCreate.length > 0) {
                        await tx.attachment.createMany({ data: attachmentsToCreate });
                    }
                }

                return tx.list.findUnique({
                    where: { id: newList.id },
                    include: { cards: true },
                });
            });

            revalidatePath(`/board/${boardId}`);
            return list;
        } catch (error) {
            console.error("copyList error:", error);
            throw new Error("Failed to copy list.");
        }
    });
