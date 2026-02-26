import { z } from "zod";
export const UpdateAttachmentCoverSchema = z.object({
    id: z.string(),
    cardId: z.string(),
    boardId: z.string(),
});
