"use server";

import { actionClient } from "@/lib/create-safe-action";
import { InitiateMidjourney } from "./schema";

export const initiateMidjourney = actionClient
    .schema(InitiateMidjourney)
    .action(async ({ parsedInput: { prompt, boardId, cardId } }) => {

        try {
            const GOAPI_KEY = process.env.MIDJOURNEY_API_KEY;
            if (!GOAPI_KEY) {
                return {
                    error: "Midjourney API Key missing. Please set MIDJOURNEY_API_KEY in your environment variables."
                };
            }

            // Using GoAPI (https://www.goapi.ai/midjourney-api) as the default provider format
            const response = await fetch("https://api.midjourneyapi.xyz/mj/v2/imagine", {
                method: "POST",
                headers: {
                    "X-API-KEY": GOAPI_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    prompt: prompt,
                    process_mode: "relax", // relax mode is cheaper/slower, good for testing
                }),
            });

            const result = await response.json();

            if (!response.ok || result.status === "failed") {
                return {
                    error: result.message || "Failed to initiate Midjourney generation."
                };
            }

            // GoAPI returns task_id
            if (!result.task_id) {
                return {
                    error: "No task ID returned from API."
                }
            }

            return { data: { taskId: result.task_id } };
        } catch (error) {
            return {
                error: "Failed to connect to Midjourney API.",
            };
        }
    });
