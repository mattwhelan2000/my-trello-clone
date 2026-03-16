import { z } from "zod";
import { ActionState } from "@/lib/create-safe-action";
import { UpdateListColors } from "./schema";

export type InputType = z.infer<typeof UpdateListColors>;
export type ReturnType = ActionState<InputType, { count: number }>;
