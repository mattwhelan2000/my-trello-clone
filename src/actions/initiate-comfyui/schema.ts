import { z } from "zod";

export const InitiateComfyUI = z.object({
  prompt: z.string().min(1, { message: "Prompt is required" }),
  boardId: z.string(),
  cardId: z.string(),
  width: z.number().int().optional().default(1024),
  height: z.number().int().optional().default(1024),
});
