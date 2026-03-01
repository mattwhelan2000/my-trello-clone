import { z } from "zod";

export const DeleteLabelSchema = z.object({
    id: z.string(),
    boardId: z.string(),
});
