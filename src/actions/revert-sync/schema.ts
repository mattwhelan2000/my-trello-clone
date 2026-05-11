import { z } from "zod";

export const RevertSyncSchema = z.object({
    boardId: z.string(),
});
