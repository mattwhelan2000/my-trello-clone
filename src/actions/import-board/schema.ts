import { z } from "zod";

export const ImportBoardSchema = z.object({
    title: z.string(),
    bgColor: z.string().nullable().optional(),
    bgImage: z.string().nullable().optional(),
    lists: z.array(z.object({
        title: z.string(),
        order: z.number(),
        color: z.string().nullable().optional(),
        cards: z.array(z.object({
            title: z.string(),
            description: z.string().nullable().optional(),
            order: z.number(),
            dueDate: z.string().nullable().optional(), // Date fields serialized as strings in JSON
            labels: z.array(z.object({
                title: z.string(),
                color: z.string()
            })).optional(),
            checklists: z.array(z.object({
                title: z.string(),
                items: z.array(z.object({
                    title: z.string(),
                    isCompleted: z.boolean()
                }))
            })).optional(),
            attachments: z.array(z.object({
                url: z.string(),
                type: z.string(),
                title: z.string().nullable().optional(),
                thumbnailUrl: z.string().nullable().optional(),
                isCover: z.boolean()
            })).optional()
        }))
    }))
});
