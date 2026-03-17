import { z } from "zod";

export const SaveScriptSchema = z.object({
  id: z.string().optional(),
  workspaceId: z.string(),
  title: z.string().min(1, "Title is required"),
  author: z.string().optional(),
  jsonContent: z.string(), // We send the stringified JSON here to be converted to a blob
});
