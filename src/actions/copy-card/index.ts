"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CopyCardSchema } from "./schema";

export const copyCard = actionClient
    .schema(CopyCardSchema)
    .action(async ({ parsedInput: { id, boardId } }) => {
        try {
            const cardToCopy = await db.card.findUnique({
                where: { id },
                include: { attachments: true, checklists: { include: { items: true } } },
            });
            if (!cardToCopy) return { error: "Card not found" };

            const lastCard = await db.card.findFirst({
                where: { listId: cardToCopy.listId },
                orderBy: { order: "desc" },
                select: { order: true },
            });
            const newOrder = lastCard ? lastCard.order + 1 : 0;

            const card = await db.card.create({
                data: {
                    title: `${cardToCopy.title} - Copy`,
                    description: cardToCopy.description,
                    order: newOrder,
                    listId: cardToCopy.listId,
                    dueDate: cardToCopy.dueDate,
                    attachments: {
                        createMany: {
                            data: cardToCopy.attachments.map(att => ({
                                url: att.url,
                                type: att.type,
                                title: att.title,
                                thumbnailUrl: att.thumbnailUrl,
                            }))
                        }
                    }
                },
            });

            revalidatePath(`/board/${boardId}`);
            return card;
        } catch (error) {
            return { error: "Failed to copy card." };
        }
    });
