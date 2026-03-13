import { z } from "zod";

export const CreateWorkflow = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  json: z.string().min(1, { message: "JSON is required" }).refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, { message: "Invalid JSON format" }),
});
