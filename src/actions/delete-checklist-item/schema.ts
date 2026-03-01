import { z } from "zod";

export const DeleteChecklistItemSchema = z.object({
    id: z.string(),
    boardId: z.string(),
});
