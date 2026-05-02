import { z } from "zod";

export const DeleteLabelBatchSchema = z.object({
    boardId: z.string(),
    labelTitle: z.string(),
});
