import { z } from "zod";

export const MoveCardsBatchSchema = z.object({
    ids: z.array(z.string()),
    boardId: z.string(),
    targetPosition: z.number().min(1),
});
