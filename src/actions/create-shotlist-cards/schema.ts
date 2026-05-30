import { z } from "zod";

export const CreateShotlistCardsSchema = z.object({
    boardId: z.string(),
    scenes: z.array(z.any()), // We will pass the parsed ShotlistScene objects
    lists: z.array(z.object({
        id: z.string(),
        title: z.string(),
    })),
    duplicateToAllParts: z.boolean().default(false),
    globalColor: z.string().nullable().optional(),
    globalLabel: z.string().nullable().optional(),
    globalLabelColor: z.string().nullable().optional(),
});
