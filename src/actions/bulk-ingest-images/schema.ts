import { z } from "zod";

export const BulkIngestSchema = z.object({
    boardId: z.string(),
    urls: z.array(z.string())
});
