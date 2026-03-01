import { z } from "zod";

export const UpdateCardSchema = z.object({
    id: z.string(),
    title: z.string().min(1, { message: "Title is required" }).optional(),
    boardId: z.string(),
    color: z.string().optional(),
    fontColor: z.string().optional(),
    dueDate: z.coerce.date().nullable().optional(),
});
