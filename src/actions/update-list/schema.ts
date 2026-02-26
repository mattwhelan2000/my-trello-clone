import { z } from "zod";

export const UpdateListSchema = z.object({
    id: z.string(),
    title: z.string().min(1, { message: "Title is required" }),
    boardId: z.string(),
    color: z.string().optional(),
});
