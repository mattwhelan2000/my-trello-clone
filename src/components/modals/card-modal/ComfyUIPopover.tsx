"use client";

import { useState, useRef, ElementRef, useEffect, FormEvent } from "react";
import { Sparkles, X, Loader2 } from "lucide-react";

import { useToast } from "@/components/ui/Toast";
import { useAction } from "@/hooks/use-action";
import { initiateComfyUI } from "@/actions/initiate-comfyui";
import { checkComfyUIStatus } from "@/actions/check-comfyui-status";
import { createAttachment } from "@/actions/create-attachment"; 

interface ComfyUIPopoverProps {
    cardId: string;
    boardId: string;
    onClose: () => void;
}

export const ComfyUIPopover = ({
    cardId,
    boardId,
    onClose
}: ComfyUIPopoverProps) => {
    const [prompt, setPrompt] = useState("");
    const [resolution, setResolution] = useState("1024x1024");
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusText, setStatusText] = useState("");
    const inputRef = useRef<ElementRef<"textarea">>(null);
    const { addToast } = useToast();
    const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

    const { execute: executeInitiateSafe } = useAction(initiateComfyUI, {
        onSuccess: (data: any) => {
            const taskId = data?.taskId || data?.data?.taskId;
            if (taskId) {
                setActiveTaskId(taskId);
                setStatusText("Waiting for your PC...");
            } else {
                const errMsg = data?.error || data?.data?.error || "Failed to retrieve a valid task ID.";
                addToast(String(errMsg), "error");
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
            addToast("Image generated and attached from home PC!", "success");
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
             const resultRaw = await checkComfyUIStatus({ taskId: activeTaskId });
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
                     addToast("Generation failed on ComfyUI.", "error");
                     setIsGenerating(false);
                     setActiveTaskId(null);
                     clearInterval(pollTimer);
                 } else if (returnData.status === "finished" && returnData.imageUrl) {
                     clearInterval(pollTimer);
                     setStatusText("Attaching image...");
                     // Warning caveat: This attaches the Ngrok tunnel direct URL.
                     // The image depends on the tunnel and PC staying online. Future enhancement would pipe this to S3.
                     executeCreateAttachment({
                         url: returnData.imageUrl,
                         boardId,
                         id: cardId, // Action takes 'id' as cardId usually
                         type: "IMAGE"
                     });
                     setActiveTaskId(null);
                 } else {
                     // Still processing or pending
                     setStatusText(`Generating... ${returnData.progress || ""}`);
                 }
             }
        }, 3000);

        return () => clearInterval(pollTimer);
    }, [activeTaskId, boardId, cardId, executeCreateAttachment, addToast, onClose]);

    const handleFormSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isGenerating) return;
        setIsGenerating(true);
        setStatusText("Initiating request to Home Server...");
        const [width, height] = resolution.split('x').map(Number);
        executeInitiateSafe({ prompt, width, height, boardId, cardId });
    };

    return (
        <div className="absolute top-full left-0 z-10 w-72 bg-white rounded-md shadow-xl border border-neutral-200 px-3 py-3 mt-1 text-neutral-700">
            <div className="flex items-center justify-between mb-2 pb-1 border-b">
                <span className="text-sm font-semibold text-neutral-600 text-center w-full flex items-center justify-center gap-x-2">
                    <Sparkles className="h-4 w-4 text-pink-600" />
                    AI Image Generator
                </span>
                {!isGenerating && (
                    <button onClick={onClose} className="absolute right-2 px-1 py-1 hover:bg-neutral-100 rounded-sm">
                        <X className="h-4 w-4 text-neutral-600" />
                    </button>
                )}
            </div>

            {isGenerating ? (
                 <div className="flex flex-col items-center justify-center py-6 gap-y-4">
                     <Loader2 className="h-8 w-8 animate-spin text-pink-600" />
                     <div className="text-sm font-medium text-neutral-600 text-center px-4">
                         {statusText}
                     </div>
                     <p className="text-[10px] text-neutral-400 text-center mt-2">
                         Pinging your local ComfyUI instance. Keep your PC awake!
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
                            className="text-sm px-2 py-1.5 border rounded-sm outline-none focus:ring-1 focus:ring-pink-600 w-full resize-none h-24"
                            autoFocus
                        />
                    </div>
                    
                    <div className="flex flex-col gap-y-1">
                        <label className="text-xs font-semibold text-neutral-600">Resolution</label>
                        <select
                            value={resolution}
                            onChange={(e) => setResolution(e.target.value)}
                            className="text-sm px-2 py-1.5 border rounded-sm outline-none w-full bg-white cursor-pointer focus:ring-1 focus:ring-pink-600"
                        >
                            <option value="256x256">256 x 256 (Fast)</option>
                            <option value="512x512">512 x 512 (Standard)</option>
                            <option value="1024x1024">1024 x 1024 (High Res)</option>
                        </select>
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={!prompt.trim()} 
                        className="bg-pink-600 text-white rounded-sm text-sm font-medium px-4 py-2 hover:bg-pink-700 w-full transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-x-2"
                    >
                        <Sparkles className="h-4 w-4" />
                        Generate Image
                    </button>
                    
                    <p className="text-[10px] text-neutral-400 mt-1 leading-relaxed text-center">
                        Images are generated locally using your ComfyUI server tunnel.
                    </p>
                </form>
            )}
        </div>
    );
};
