import { z } from "zod";

export const ExportBoardSchema = z.object({
    id: z.string(),
});
