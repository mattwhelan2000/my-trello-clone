"use server";

import { actionClient } from "@/lib/create-safe-action";
import { CheckComfyUIStatus } from "./schema";

export const checkComfyUIStatus = actionClient
    .schema(CheckComfyUIStatus)
    .action(async ({ parsedInput: { taskId } }) => {
        try {
            let configUrl = (process.env.COMFYUI_API_URL || "").replace(/['"]/g, "").trim();
            // Aggressively strip "COMFYUI_API_URL=" if the user accidentally pasted it in Vercel
            if (configUrl.startsWith("COMFYUI_API_URL=")) {
                configUrl = configUrl.replace("COMFYUI_API_URL=", "");
            }
            if (configUrl && !configUrl.startsWith('http')) {
                configUrl = `https://${configUrl}`;
            }
            const COMFYUI_API_URL = configUrl.endsWith('/') ? configUrl.slice(0, -1) : configUrl;

            if (!COMFYUI_API_URL) {
                return { error: "ComfyUI API URL missing." };
            }

            const response = await fetch(`${COMFYUI_API_URL}/history/${taskId}`, {
                headers: {
                    "ngrok-skip-browser-warning": "true"
                }
            });
            
            if (!response.ok) {
                // Usually means not done yet, or server down
                return { error: "Failed to grab ComfyUI history. Tunnel down?" };
            }

            const history = await response.json();

            // If the task ID is in the history keys, it means it's finished.
            if (history[taskId]) {
                const outputs = history[taskId].outputs;
                
                // Find the node that saved the image (e.g., Node 9 in our default workflow)
                // We'll grab the first output that has an 'images' array.
                let imageUrl = "";
                for (const nodeId in outputs) {
                    if (outputs[nodeId].images && outputs[nodeId].images.length > 0) {
                        const imgSource = outputs[nodeId].images[0];
                        const filename = encodeURIComponent(imgSource.filename);
                        const subfolder = encodeURIComponent(imgSource.subfolder || "");
                        const type = encodeURIComponent(imgSource.type || "output");
                        
                        // Construct the image URL that returns the PNG stream from ComfyUI
                        imageUrl = `${COMFYUI_API_URL}/view?filename=${filename}&subfolder=${subfolder}&type=${type}`;
                        break;
                    }
                }

                if (imageUrl) {
                    return {
                        data: {
                            status: "finished",
                            imageUrl: imageUrl
                        }
                    };
                } else {
                    return { error: "ComfyUI finished but returned no image outputs." };
                }
            }

            // Still processing (ComfyUI doesn't easily expose progress % via REST, only via websockets)
            return {
                data: {
                    status: "processing",
                    progress: "Generating on your PC..."
                }
            };

        } catch (error) {
            return {
                error: "Failed to connect to ComfyUI proxy.",
            };
        }
    });
