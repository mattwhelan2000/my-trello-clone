import { z } from "zod";

export const UpdateAttachmentSchema = z.object({
    id: z.string(),
    boardId: z.string(),
    title: z.string().min(1, "Title is required"),
});
