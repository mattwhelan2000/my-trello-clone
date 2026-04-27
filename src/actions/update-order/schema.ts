import { z } from "zod";

export const UpdateListOrderSchema = z.object({
    items: z.array(
        z.object({
            id: z.string(),
            title: z.string(),
            order: z.number(),
            boardId: z.string()
        })
    ),
    boardId: z.string(),
});

export const UpdateCardOrderSchema = z.object({
    items: z.array(
        z.object({
            id: z.string(),
            title: z.string(),
            order: z.number(),
            listId: z.string(),
        })
    ),
    boardId: z.string(),
});
