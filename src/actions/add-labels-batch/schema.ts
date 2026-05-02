import { z } from "zod";

export const AddLabelsBatchSchema = z.object({
    cardIds: z.array(z.string()),
    boardId: z.string(),
    labelTitle: z.string(),
    labelColor: z.string(),
});
