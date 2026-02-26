import { z } from "zod";
export const PasteListSchema = z.object({
    sourceListId: z.string(),
    boardId: z.string(),
});
