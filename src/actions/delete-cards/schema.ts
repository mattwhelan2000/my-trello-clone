import { z } from "zod";

export const DeleteCardsSchema = z.object({
    ids: z.array(z.string()),
    boardId: z.string(),
});
