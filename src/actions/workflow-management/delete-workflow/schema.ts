import { z } from "zod";

export const DeleteWorkflow = z.object({
  id: z.string(),
});
