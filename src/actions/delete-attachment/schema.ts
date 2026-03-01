import { z } from "zod";

export const DeleteAttachmentSchema = z.object({
    id: z.string(),
    boardId: z.string(),
});
