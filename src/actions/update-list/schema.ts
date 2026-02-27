import { z } from "zod";

export const UpdateListSchema = z.object({
    title: z.string().min(3, { message: "Title is too short" }).optional(),
    id: z.string(),
    boardId: z.string(),
    color: z.string().optional(),
    fontColor: z.string().optional(),
});
