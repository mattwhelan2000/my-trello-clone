import { z } from "zod";

export const InstanceCardSchema = z.object({
    id: z.string(),
    boardId: z.string(),
    listIds: z.array(z.string()),
    position: z.number().optional(), // If provided, insert at this position (1-indexed)
});
