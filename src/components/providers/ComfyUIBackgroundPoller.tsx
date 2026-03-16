"use client";

import { useEffect, useRef } from "react";
import { useComfyUIStore } from "@/hooks/use-comfyui-store";
import { checkComfyUIStatus } from "@/actions/check-comfyui-status";
import { createAttachment } from "@/actions/create-attachment";
import { useAction } from "@/hooks/use-action";
import { useToast } from "@/components/ui/Toast";

export const ComfyUIBackgroundPoller = () => {
    const { tasks, removeTask, updateTaskStatus } = useComfyUIStore();
    const { addToast } = useToast();
    
    const { execute: executeCreateAttachment } = useAction(createAttachment, {
        onSuccess: (data) => {
            addToast("Background image generation finished and attached!", "success");
        },
        onError: (error) => {
            addToast(`Failed to attach generated image: ${error}`, "error");
        }
    });

    // Track which tasks we are actively polling to prevent double intervals
    const activePolls = useRef<Set<string>>(new Set());

    useEffect(() => {
        tasks.forEach(task => {
            if (activePolls.current.has(task.taskId)) return;

            activePolls.current.add(task.taskId);

            const pollTimer = setInterval(async () => {
                const resultRaw = await checkComfyUIStatus({ taskId: task.taskId });
                const result = resultRaw as any; // Bypass SafeActionResult typing complexity

                if (result?.data?.error || result?.error || result?.serverError) {
                    addToast(result?.data?.error || result?.error || result?.serverError || "Failed ComfyUI generation.", "error");
                    clearInterval(pollTimer);
                    activePolls.current.delete(task.taskId);
                    removeTask(task.taskId);
                    return;
                }

                const returnData = result?.data?.data || result?.data;

                if (returnData) {
                    if (returnData.status === "failed") {
                        addToast("Background generation failed on ComfyUI.", "error");
                        clearInterval(pollTimer);
                        activePolls.current.delete(task.taskId);
                        removeTask(task.taskId);
                    } else if (returnData.status === "finished" && returnData.imageUrl) {
                        clearInterval(pollTimer);
                        activePolls.current.delete(task.taskId);
                        
                        // Attach the image
                        executeCreateAttachment({
                            url: returnData.imageUrl,
                            boardId: task.boardId,
                            id: task.cardId, 
                            type: "IMAGE",
                            title: ""
                        });
                        
                        removeTask(task.taskId);
                    } else {
                        // Still processing
                        if (returnData.progress && returnData.progress !== task.statusText) {
                            updateTaskStatus(task.taskId, `Generating... ${returnData.progress}`);
                        }
                    }
                }
            }, 3000);
        });

        // Cleanup function isn't strictly necessary per-task on unmount because 
        // this component will live globally as long as the user is on the dashboard.
    }, [tasks, removeTask, updateTaskStatus, addToast, executeCreateAttachment]);

    // This component renders nothing visually
    return null;
};
