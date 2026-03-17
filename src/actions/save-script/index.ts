"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { SaveScriptSchema } from "./schema";
import { put } from "@vercel/blob";

export const saveScript = actionClient
  .schema(SaveScriptSchema)
  .action(async ({ parsedInput: { id, workspaceId, title, author, jsonContent } }) => {
    try {
      // 1. Upload to Vercel Blob
      // We generate a unique filename for this script version
      const filename = `scripts/${workspaceId}/${id || 'new'}-${Date.now()}.json`;
      
      const blob = await put(filename, jsonContent, {
        access: 'public',
        contentType: 'application/json',
      });

      let script;

      // 2. Save or Update Postgres record
      if (id) {
        script = await db.script.update({
          where: { id },
          data: {
            title,
             author,
            jsonUrl: blob.url,
          },
        });
      } else {
        script = await db.script.create({
          data: {
            workspaceId,
            title,
             author,
            jsonUrl: blob.url,
          },
        });
      }

      revalidatePath(`/workspace/${workspaceId}`);
      return script;
    } catch (error) {
      console.error(error);
      return { error: "Failed to save script." };
    }
  });
