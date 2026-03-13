"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateWorkflow } from "./schema";

export const createWorkflow = actionClient
  .schema(CreateWorkflow)
  .action(async ({ parsedInput: { name, json } }) => {
    try {
      const workflow = await db.comfyUIWorkflow.create({
        data: {
          name,
          json,
        },
      });

      revalidatePath("/workflows");
      return workflow;
    } catch (error) {
      return {
        error: "Failed to create workflow.",
      };
    }
  });
