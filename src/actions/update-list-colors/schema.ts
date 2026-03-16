import { z } from "zod";

export const UpdateListColors = z.object({
  boardId: z.string(),
  color: z.string().min(1, {
    message: "Color is required",
  }),
});
