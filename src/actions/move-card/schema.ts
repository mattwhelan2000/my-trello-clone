import { z } from "zod";

export const MoveCardSchema = z.object({
    cardId: z.string(),
    targetListId: z.string(),
    boardId: z.string(),
});
