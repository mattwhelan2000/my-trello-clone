import { z } from "zod";

export const SyncGoogleSheetSchema = z.object({
    boardId: z.string(),
});
