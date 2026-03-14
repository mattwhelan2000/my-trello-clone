"use server";

import { actionClient } from "@/lib/create-safe-action";
import { InitiateComfyUI } from "./schema";
import { db } from "@/lib/db";

export const initiateComfyUI = actionClient
    .schema(InitiateComfyUI)
    .action(async ({ parsedInput: { prompt, width, height, workflowId, boardId, cardId } }) => {
        try {
            // Strip any trailing slashes from the URL
            let configUrl = (process.env.COMFYUI_API_URL || "").replace(/['"]/g, "").trim();
            // Aggressively strip "COMFYUI_API_URL=" if the user accidentally pasted it in Vercel
            if (configUrl.startsWith("COMFYUI_API_URL=")) {
                configUrl = configUrl.replace("COMFYUI_API_URL=", "");
            }
            if (configUrl && !configUrl.startsWith('http')) {
                configUrl = `https://${configUrl}`;
            }
            const COMFYUI_API_URL = configUrl.endsWith('/') ? configUrl.slice(0, -1) : configUrl;
            
            console.log("[COMFYUI] Calling URL:", `${COMFYUI_API_URL}/prompt`);
            
            if (!COMFYUI_API_URL) {
                return {
                    error: "ComfyUI API URL missing. Please set COMFYUI_API_URL in your environment variables (e.g., your Ngrok URL)."
                };
            }

            let workflowObj: any;
            let workflowName = "Unknown Workflow";

            if (workflowId) {
                const dbWorkflow = await db.comfyUIWorkflow.findUnique({ where: { id: workflowId } });
                if (!dbWorkflow) {
                    return { error: "Selected workflow not found in database." };
                }
                workflowName = dbWorkflow.name;
                try {
                    workflowObj = JSON.parse(dbWorkflow.json);
                } catch (e) {
                    return { error: "Selected workflow contains invalid JSON." };
                }
            } else {
                return { error: "No workflow selected. Please add one in the Workflows tab." };
            }

            // Dynamically inject values into the workflow JSON
            for (const key in workflowObj) {
                const node = workflowObj[key];
                if (!node || !node.inputs) continue;

                // Inject prompt into the first CLIPTextEncode (or any node with a 'text' input that looks like a prompt)
                if (node.class_type === "CLIPTextEncode" && "text" in node.inputs) {
                    node.inputs.text = prompt;
                }

                // Inject dynamic seed into any node with 'seed' or 'noise_seed'
                if ("noise_seed" in node.inputs) {
                    node.inputs.noise_seed = Math.floor(Math.random() * 100000000000000);
                } else if ("seed" in node.inputs) {
                    node.inputs.seed = Math.floor(Math.random() * 100000000000000);
                }

                // Inject width and height
                if ("width" in node.inputs && typeof node.inputs.width === "number") {
                    node.inputs.width = width;
                }
                if ("height" in node.inputs && typeof node.inputs.height === "number") {
                    node.inputs.height = height;
                }
            }

            const response = await fetch(`${COMFYUI_API_URL}/prompt`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "ngrok-skip-browser-warning": "true"
                },
                body: JSON.stringify({ prompt: workflowObj }),
            });

            if (!response.ok) {
                const text = await response.text();
                return { error: `ComfyUI API HTTP ${response.status}: ${text}` };
            }

            const result = await response.json();

            if (!result.prompt_id) {
                return { error: `No prompt_id returned from ComfyUI. Response: ${JSON.stringify(result)}` }
            }

            // Append prompt to card description
            const card = await db.card.findUnique({
                where: { id: cardId }
            });

            if (card) {
                const newDescription = card.description 
                    ? `${card.description}\n\n**AI Generated Image Prompt (${workflowName}):**\n> ${prompt}` 
                    : `**AI Generated Image Prompt (${workflowName}):**\n> ${prompt}`;
                
                await db.card.update({
                    where: { id: cardId },
                    data: { description: newDescription }
                });
            }

            return { data: { taskId: result.prompt_id } };
        } catch (error: any) {
            console.error("[COMFYUI] Initiation Error:", error);
            return {
                error: `Failed to communicate with ComfyUI: ${error?.message || String(error)}`,
            };
        }
    });
