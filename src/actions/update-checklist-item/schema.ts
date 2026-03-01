import { z } from "zod";

export const UpdateChecklistItemSchema = z.object({
    id: z.string(),
    boardId: z.string(),
    isCompleted: z.boolean(),
});
