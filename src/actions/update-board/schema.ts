import { z } from "zod";

export const UpdateBoardSchema = z.object({
    id: z.string(),
    bgImage: z.string().optional(),
    bgColor: z.string().optional(),
});
