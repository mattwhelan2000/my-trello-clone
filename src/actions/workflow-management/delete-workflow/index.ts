"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { DeleteWorkflow } from "./schema";

export const deleteWorkflow = actionClient
  .schema(DeleteWorkflow)
  .action(async ({ parsedInput: { id } }) => {
    try {
      const workflow = await db.comfyUIWorkflow.delete({
        where: { id },
      });

      revalidatePath("/workflows");
      return { data: workflow };
    } catch (error) {
      return {
        error: "Failed to delete workflow.",
      };
    }
  });
