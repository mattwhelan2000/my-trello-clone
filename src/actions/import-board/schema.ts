import { z } from "zod";

export const ImportBoardSchema = z.object({
    title: z.string(),
    bgColor: z.string().nullable().optional(),
    bgImage: z.string().nullable().optional(),
    googleSheetId: z.string().nullable().optional(),
    colorSwatches: z.array(z.string()).optional(),
    listColorSwatches: z.array(z.string()).optional(),
    textColorSwatches: z.array(z.string()).optional(),
    lists: z.array(z.object({
        title: z.string(),
        order: z.number(),
        color: z.string().nullable().optional(),
        fontColor: z.string().nullable().optional(),
        isSyncedWithSheet: z.boolean().optional(),
        cards: z.array(z.object({
            title: z.string(),
            description: z.string().nullable().optional(),
            order: z.number(),
            color: z.string().nullable().optional(),
            fontColor: z.string().nullable().optional(),
            dueDate: z.string().nullable().optional(), // Date fields serialized as strings in JSON
            isSyncedWithSheet: z.boolean().optional(),
            syncGroupId: z.string().nullable().optional(),
            displayThumbnails: z.boolean().optional(),
            isSlim: z.boolean().optional(),
            labels: z.array(z.object({
                title: z.string(),
                color: z.string()
            })).optional(),
            checklists: z.array(z.object({
                title: z.string(),
                createdAt: z.string().optional(),
                items: z.array(z.object({
                    title: z.string(),
                    isCompleted: z.boolean(),
                    createdAt: z.string().optional()
                }))
            })).optional(),
            attachments: z.array(z.object({
                url: z.string(),
                type: z.string(),
                title: z.string().nullable().optional(),
                thumbnailUrl: z.string().nullable().optional(),
                isCover: z.boolean()
            })).optional(),
            activities: z.array(z.object({
                userId: z.string(),
                action: z.string(),
                createdAt: z.string()
            })).optional()
        }))
    }))
});
