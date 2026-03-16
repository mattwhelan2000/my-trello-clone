import { z } from "zod";

export const UpdateBoardSchema = z.object({
    id: z.string(),
    title: z.string().optional(),
    bgImage: z.string().optional(),
    bgColor: z.string().optional(),
    colorSwatches: z.array(z.string()).optional(),
    listColorSwatches: z.array(z.string()).optional(),
    textColorSwatches: z.array(z.string()).optional(),
    googleSheetId: z.string().optional(),
});
