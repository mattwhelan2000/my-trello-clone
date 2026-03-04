import { z } from "zod";
export const CloneCardSchema = z.object({
    id: z.string(),
    boardId: z.string(),
});
