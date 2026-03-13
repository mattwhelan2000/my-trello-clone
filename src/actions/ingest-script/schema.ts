import { z } from "zod";

export const IngestScriptSchema = z.object({
  formData: z.custom<FormData>((val) => val instanceof FormData, {
    message: "Must be a FormData object containing the PDF file",
  }),
});
