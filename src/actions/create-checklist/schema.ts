import { z } from "zod";

export const CreateChecklistSchema = z.object({
    title: z.string().min(1, { message: "Title is required" }),
    cardId: z.string(),
    boardId: z.string(),
});
