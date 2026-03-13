import { z } from "zod";
import { DeleteWorkflow } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { ComfyUIWorkflow } from "@prisma/client";

export type InputType = z.infer<typeof DeleteWorkflow>;
export type ReturnType = ActionState<InputType, ComfyUIWorkflow>;
