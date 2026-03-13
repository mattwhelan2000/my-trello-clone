"use server";

import { actionClient } from "@/lib/create-safe-action";
import { CheckMidjourneyStatus } from "./schema";

export const checkMidjourneyStatus = actionClient
    .schema(CheckMidjourneyStatus)
    .action(async ({ parsedInput: { taskId } }) => {

        try {
            const GOAPI_KEY = process.env.MIDJOURNEY_API_KEY;
            if (!GOAPI_KEY) {
                return {
                    error: "Midjourney API Key missing."
                };
            }

            // Using GoAPI fetch endpoint
            const response = await fetch("https://api.midjourneyapi.xyz/mj/v2/fetch", {
                method: "POST",
                headers: {
                    "X-API-KEY": GOAPI_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    task_id: taskId,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                return {
                    error: result.message || "Failed to check Midjourney status."
                };
            }

            // GoAPI statuses: pending, processing, finished, failed
            const statusStr = result.status as string;

            if (statusStr === "failed") {
                return {
                    error: "Midjourney generation failed: " + (result.fail_reason || "Unknown error")
                };
            }

            if (statusStr === "finished") {
                return {
                    data: {
                        status: "finished",
                        imageUrl: result.task_result?.image_url as string
                    }
                };
            }

            // Still processing
            return {
                data: {
                    status: statusStr as string,
                    progress: (result.process || "0%") as string
                }
            };

        } catch (error) {
            return {
                error: "Failed to connect to Midjourney API.",
            };
        }
    });
