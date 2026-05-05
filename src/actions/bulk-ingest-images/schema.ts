import { z } from "zod";

export const BulkIngestSchema = z.object({
    boardId: z.string(),
    urls: z.array(z.string()),
    isAnalysis: z.boolean().optional().default(false),
    resolutions: z.record(z.string(), z.enum(["ignore", "replace"])).optional(),
    defaultResolution: z.enum(["ignore", "replace"]).optional(),
    // Optimized path: pass resolved files back to avoid redundant Drive/Dropbox scans
    resolvedFiles: z.array(z.object({
        name: z.string(),
        url: z.string(),
        id: z.string().optional(),
        mimeType: z.string().optional(),
    })).optional(),
    // Per-file overrides applied in the Preview Dialog
    fileOverrides: z.record(z.string(), z.object({
        enabled: z.boolean().optional(),
        color: z.string().optional(),
        label: z.string().optional(),
        labelColor: z.string().optional(),
    })).optional(),
    // Global overrides for color/label applied to all cards in the batch
    globalColor: z.string().optional(),
    globalLabel: z.string().optional(),
    globalLabelColor: z.string().optional(),
});

// Used by the API route that lists a Dropbox folder
export const ListDropboxFolderSchema = z.object({
    folderUrl: z.string(),
});
