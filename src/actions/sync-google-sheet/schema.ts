import { z } from "zod";

export const SyncGoogleSheetSchema = z.object({
    boardId: z.string(),
    analyze: z.boolean().optional(),
    tabName: z.string().optional(),
});
