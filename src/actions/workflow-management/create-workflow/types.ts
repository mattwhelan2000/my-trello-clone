import { z } from "zod";
import { CreateWorkflow } from "./schema";
import { ActionState } from "@/lib/create-safe-action";
import { ComfyUIWorkflow } from "@prisma/client";

export type InputType = z.infer<typeof CreateWorkflow>;
export type ReturnType = ActionState<InputType, ComfyUIWorkflow>;
