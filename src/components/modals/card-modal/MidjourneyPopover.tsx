"use client";

import { useState, useRef, ElementRef, useEffect, FormEvent } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";

import { useToast } from "@/components/ui/Toast";
import { useAction } from "@/hooks/use-action";
import { initiateMidjourney } from "@/actions/initiate-midjourney";
import { checkMidjourneyStatus } from "@/actions/check-midjourney-status";
import { createAttachment } from "@/actions/create-attachment"; 

interface MidjourneyPopoverProps {
    cardId: string;
    boardId: string;
    onClose: () => void;
}

export const MidjourneyPopover = ({
    cardId,
    boardId,
    onClose
}: MidjourneyPopoverProps) => {
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusText, setStatusText] = useState("");
    const inputRef = useRef<ElementRef<"textarea">>(null);
    const { addToast } = useToast();
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

    const { execute: executeInitiateSafe } = useAction(initiateMidjourney, {
        onSuccess: (data: any) => {
            const taskId = data?.taskId || data?.data?.taskId;
            if (taskId) {
                setActiveTaskId(taskId);
                setStatusText("Waiting to start...");
            } else {
                addToast("Failed to retrieve a valid task ID.", "error");
                setIsGenerating(false);
            }
        },
        onError: (error: string) => {
            addToast(error, "error");
            setIsGenerating(false);
        }
    });

    const { execute: executeCreateAttachment } = useAction(createAttachment, {
        onSuccess: () => {
            addToast("Image generated and attached!", "success");
            setIsGenerating(false);
            onClose();
        },
        onError: (error: string) => {
            addToast(error, "error");
            setIsGenerating(false);
            onClose();
        }
    });

    useEffect(() => {
        if (!activeTaskId) return;

        const pollTimer = setInterval(async () => {
             const resultRaw = await checkMidjourneyStatus({ taskId: activeTaskId });
             const result = resultRaw as any; // Bypass SafeActionResult typing complexity

             if (result?.data?.error || result?.error || result?.serverError) {
                 addToast(result?.data?.error || result?.error || result?.serverError || "Failed", "error");
                 setIsGenerating(false);
                 setActiveTaskId(null);
                 clearInterval(pollTimer);
                 return;
             }

             const returnData = result?.data?.data || result?.data;

             if (returnData) {
                 if (returnData.status === "failed") {
                     addToast("Generation failed on Midjourney's side.", "error");
                     setIsGenerating(false);
                     setActiveTaskId(null);
                     clearInterval(pollTimer);
                 } else if (returnData.status === "finished" && returnData.imageUrl) {
                     clearInterval(pollTimer);
                     setStatusText("Attaching image...");
                     // Attach it to the card using existing attach action
                     executeCreateAttachment({
                         url: returnData.imageUrl,
                         boardId,
                         id: cardId, // Action takes 'id' as cardId usually
                         type: "IMAGE"
                     });
                     setActiveTaskId(null);
                 } else {
                     // Still processing or pending
                     setStatusText(`Generating... ${returnData.progress || "0%"}`);
                 }
             }
        }, 4000);

        return () => clearInterval(pollTimer);
    }, [activeTaskId, boardId, cardId, executeCreateAttachment, addToast, onClose]);

    const handleFormSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isGenerating) return;
        setIsGenerating(true);
        setStatusText("Initiating request...");
        executeInitiateSafe({ prompt, boardId, cardId });
    };

    return (
        <div className="absolute top-full left-0 z-10 w-72 bg-white rounded-md shadow-xl border border-neutral-200 px-3 py-3 mt-1 text-neutral-700">
            <div className="flex items-center justify-between mb-2 pb-1 border-b">
                <span className="text-sm font-semibold text-neutral-600 text-center w-full flex items-center justify-center gap-x-2">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    Generate with Midjourney
                </span>
                {!isGenerating && (
                    <button onClick={onClose} className="absolute right-2 px-1 py-1 hover:bg-neutral-100 rounded-sm">
                        <X className="h-4 w-4 text-neutral-600" />
                    </button>
                )}
            </div>

            {isGenerating ? (
                 <div className="flex flex-col items-center justify-center py-6 gap-y-4">
                     <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                     <div className="text-sm font-medium text-neutral-600 text-center px-4">
                         {statusText}
                     </div>
                     <p className="text-[10px] text-neutral-400 text-center mt-2">
                         This usually takes 30-60 seconds. Do not close this panel.
                     </p>
                 </div>
            ) : (
                <form onSubmit={handleFormSubmit} className="flex flex-col gap-y-3 mt-2">
                    <div className="flex flex-col gap-y-1">
                        <label className="text-xs font-semibold text-neutral-600">Prompt</label>
                        <textarea
                            ref={inputRef}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="A futuristic city at sunset, cyberpunk style, octane render..."
                            className="text-sm px-2 py-1.5 border rounded-sm outline-none focus:ring-1 focus:ring-purple-600 w-full resize-none h-24"
                            autoFocus
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={!prompt.trim()} 
                        className="bg-purple-600 text-white rounded-sm text-sm font-medium px-4 py-2 hover:bg-purple-700 w-full transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-x-2"
                    >
                        <Sparkles className="h-4 w-4" />
                        Generate Image
                    </button>
                    
                    <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed text-center">
                        Images are generated using Midjourney v6 via API proxy.
                    </p>
                </form>
            )}
        </div>
    );
};
