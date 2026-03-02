import { z } from "zod";

export const CreateCommentSchema = z.object({
    cardId: z.string(),
    boardId: z.string(),
    action: z.string().min(1, { message: "Comment cannot be empty" }),
    userId: z.string().optional(),
});
