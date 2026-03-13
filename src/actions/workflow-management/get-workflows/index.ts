"use server";

import { db } from "@/lib/db";
import { ComfyUIWorkflow } from "@prisma/client";

export async function getWorkflows(): Promise<ComfyUIWorkflow[]> {
  try {
    const workflows = await db.comfyUIWorkflow.findMany({
      orderBy: { createdAt: "desc" },
    });
    return workflows;
  } catch (error) {
    console.error("Failed to get workflows", error);
    return [];
  }
}
