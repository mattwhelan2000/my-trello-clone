import { z } from "zod";

export const ImportCardsSchema = z.object({
    boardId: z.string(),
    listId: z.string(),
    cardsJson: z.string(),
});
