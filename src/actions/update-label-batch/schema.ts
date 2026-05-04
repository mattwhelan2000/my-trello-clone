import { z } from "zod";

export const UpdateLabelBatchSchema = z.object({
    boardId: z.string(),
    oldTitle: z.string(),
    newTitle: z.string().min(1, "Title is required"),
    newColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format"),
});
