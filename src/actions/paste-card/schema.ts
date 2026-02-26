import { z } from "zod";
export const PasteCardSchema = z.object({
    sourceCardId: z.string(),
    targetListId: z.string(),
    boardId: z.string(),
});
