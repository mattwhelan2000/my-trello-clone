import { z } from "zod";

export const UpdateBoardSchema = z.object({
    id: z.string(),
    title: z.string().optional(),
    bgImage: z.string().optional(),
    bgColor: z.string().optional(),
});
