import { z } from "zod";

export const CreateListSchema = z.object({
    title: z.string().min(1, { message: "Title is required" }),
    boardId: z.string(),
});
