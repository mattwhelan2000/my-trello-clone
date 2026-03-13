import { z } from "zod";

export const InitiateMidjourney = z.object({
  prompt: z.string().min(1, { message: "Prompt is required" }),
  boardId: z.string(),
  cardId: z.string(),
});
