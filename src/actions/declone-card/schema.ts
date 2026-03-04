import { z } from "zod";
export const DecloneCardSchema = z.object({
    id: z.string(),
    boardId: z.string(),
});
