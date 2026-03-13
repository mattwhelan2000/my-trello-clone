import { z } from "zod";

export const InitiateComfyUI = z.object({
  prompt: z.string().min(1, { message: "Prompt is required" }),
  boardId: z.string(),
  cardId: z.string(),
});
