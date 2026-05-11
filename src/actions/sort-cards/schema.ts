import { z } from "zod";

export const SortCardsSchema = z.object({
    boardId: z.string(),
    listId: z.string(),
    order: z.enum(["asc", "desc"]),
});
