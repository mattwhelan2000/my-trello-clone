import { z } from "zod";

export const CheckMidjourneyStatus = z.object({
  taskId: z.string().min(1, { message: "Task ID is required" }),
});
