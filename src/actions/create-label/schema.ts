import { z } from "zod";

export const CreateLabelSchema = z.object({
    cardId: z.string(),
    boardId: z.string(),
    title: z.string(),
    color: z.string().min(1, "Color is required"),
});
