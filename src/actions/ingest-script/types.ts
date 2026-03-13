import { z } from "zod";
import { ActionState } from "@/lib/create-safe-action";
import { IngestScriptSchema } from "./schema";

export type InputType = z.infer<typeof IngestScriptSchema>;
export type ReturnType = ActionState<InputType, { boardId: string }>;
