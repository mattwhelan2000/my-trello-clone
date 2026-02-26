import { z } from "zod";

export const UpdateCardDescriptionSchema = z.object({
    id: z.string(),
    description: z.string().optional(),
    boardId: z.string(),
});
