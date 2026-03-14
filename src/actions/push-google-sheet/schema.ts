import { z } from "zod";

export const PushGoogleSheetSchema = z.object({
    boardId: z.string(),
});
