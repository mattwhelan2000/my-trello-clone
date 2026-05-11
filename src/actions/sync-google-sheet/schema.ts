import { z } from "zod";

export const SyncGoogleSheetSchema = z.object({
    boardId: z.string(),
    analyze: z.boolean().optional(),
    tabName: z.string().optional(),
    globalColor: z.string().optional(),
    globalLabel: z.string().optional(),
    globalLabelColor: z.string().optional(),
    skipZeroVfx: z.boolean().optional(),
    disabledCards: z.array(z.string()).optional(),
    syncSceneLocation: z.boolean().optional(),
    syncTime: z.boolean().optional(),
    syncSetLocation: z.boolean().optional(),
    syncCharacters: z.boolean().optional(),
    syncVfx: z.boolean().optional(),
});
