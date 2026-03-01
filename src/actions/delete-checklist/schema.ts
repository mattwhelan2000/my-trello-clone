import { z } from "zod";

export const DeleteChecklistSchema = z.object({
    id: z.string(),
    boardId: z.string(),
});
