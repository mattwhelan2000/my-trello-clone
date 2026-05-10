import { z } from "zod";

export const ImportCardsSchema = z.object({
    boardId: z.string(),
    listId: z.string(),
    cardsJson: z.string(),
    isAnalysis: z.boolean().optional().default(false),
    // Per-card overrides applied in the Preview Dialog
    cardOverrides: z.record(z.string(), z.object({
        enabled: z.boolean().optional(),
        color: z.string().optional(),
        label: z.string().optional(),
        labelColor: z.string().optional(),
        listId: z.string().optional(), // For manual list override
    })).optional(),
    // Global overrides for color/label applied to all cards in the batch
    globalColor: z.string().optional(),
    globalLabel: z.string().optional(),
    globalLabelColor: z.string().optional(),
});
