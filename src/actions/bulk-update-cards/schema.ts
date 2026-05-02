import { z } from "zod";

export const BulkUpdateCardsSchema = z.object({
    boardId: z.string(),
    items: z.array(
        z.object({
            id: z.string(),
            isSlim: z.boolean().optional(),
        })
    ),
});
