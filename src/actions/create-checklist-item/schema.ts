import { z } from "zod";

export const CreateChecklistItemSchema = z.object({
    title: z.string().min(1, { message: "Title is required" }),
    checklistId: z.string(),
    boardId: z.string(),
});
