import { z } from "zod";

export const BulkIngestSchema = z.object({
    boardId: z.string(),
    urls: z.array(z.string()),
    isAnalysis: z.boolean().optional().default(false),
    resolutions: z.record(z.enum(["ignore", "replace"])).optional(),
    defaultResolution: z.enum(["ignore", "replace"]).optional(),
    // Optimized path: pass resolved files back to avoid redundant Drive scans
    resolvedFiles: z.array(z.object({
        name: z.string(),
        url: z.string(),
    })).optional(),
});
