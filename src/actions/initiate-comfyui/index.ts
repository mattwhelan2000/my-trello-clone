"use server";

import { actionClient } from "@/lib/create-safe-action";
import { InitiateComfyUI } from "./schema";

export const initiateComfyUI = actionClient
    .schema(InitiateComfyUI)
    .action(async ({ parsedInput: { prompt, boardId, cardId } }) => {
        try {
            // Strip any trailing slashes from the URL
            const configUrl = process.env.COMFYUI_API_URL || "";
            const COMFYUI_API_URL = configUrl.endsWith('/') ? configUrl.slice(0, -1) : configUrl;
            
            if (!COMFYUI_API_URL) {
                return {
                    error: "ComfyUI API URL missing. Please set COMFYUI_API_URL in your environment variables (e.g., your Ngrok URL)."
                };
            }

            // Default basic SD1.5 text2img ComfyUI workflow.
            // Node 6 is the Positive Prompt. Node 3 is KSampler. Node 9 is SaveImage.
            // (Users can replace this object with their own exported 'workflow_api.json')
            const workflow = {
                "3": {
                    "inputs": {
                        "seed": Math.floor(Math.random() * 100000000000000),
                        "steps": 20,
                        "cfg": 8,
                        "sampler_name": "euler",
                        "scheduler": "normal",
                        "denoise": 1,
                        "model": ["4", 0],
                        "positive": ["6", 0],
                        "negative": ["7", 0],
                        "latent_image": ["5", 0]
                    },
                    "class_type": "KSampler"
                },
                "4": {
                    "inputs": { "ckpt_name": "v1-5-pruned-emaonly.safetensors" },
                    "class_type": "CheckpointLoaderSimple"
                },
                "5": {
                    "inputs": { "width": 512, "height": 512, "batch_size": 1 },
                    "class_type": "EmptyLatentImage"
                },
                "6": {
                    "inputs": { "text": prompt, "clip": ["4", 1] },
                    "class_type": "CLIPTextEncode"
                },
                "7": {
                    "inputs": { "text": "bad hands, messy, watermark", "clip": ["4", 1] },
                    "class_type": "CLIPTextEncode"
                },
                "8": {
                    "inputs": { "samples": ["3", 0], "vae": ["4", 2] },
                    "class_type": "VAEDecode"
                },
                "9": {
                    "inputs": { "filename_prefix": "TrelloClone", "images": ["8", 0] },
                    "class_type": "SaveImage"
                }
            };

            const response = await fetch(`${COMFYUI_API_URL}/prompt`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: workflow }),
            });

            if (!response.ok) {
                return { error: "Failed to connect to ComfyUI. Is your Ngrok tunnel running and your PC awake?" };
            }

            const result = await response.json();

            if (!result.prompt_id) {
                return { error: "No prompt_id returned from ComfyUI API." }
            }

            return { data: { taskId: result.prompt_id } };
        } catch (error) {
            return {
                error: "Failed to communicate with ComfyUI. Ensure your Ngrok URL is correct and ComfyUI is running.",
            };
        }
    });
