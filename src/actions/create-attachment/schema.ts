import { z } from "zod";

export const CreateAttachmentSchema = z.object({
    id: z.string(), // This is the cardId
    url: z.string().url("Must be a valid URL"),
    type: z.enum(["IMAGE", "LINK", "IFRAME"]),
    boardId: z.string(),
});
