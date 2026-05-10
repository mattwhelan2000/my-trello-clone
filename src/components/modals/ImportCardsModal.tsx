"use client";

import { useState, useRef } from "react";
import { X, FileJson, Upload, ClipboardPaste, Search } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { importCards } from "@/actions/import-cards";
import { useToast } from "@/components/ui/Toast";
import { IngestPreviewDialog } from "@/components/modals/IngestPreviewDialog";
import { useRouter } from "next/navigation";

interface ImportCardsModalProps {
    boardId: string;
    listId: string;
    isOpen: boolean;
    onClose: () => void;
}

export const ImportCardsModal = ({
    boardId,
    listId,
    isOpen,
    onClose
}: ImportCardsModalProps) => {
    const router = useRouter();
    const [jsonText, setJsonText] = useState("");
    const [previewFiles, setPreviewFiles] = useState<any[]>([]);
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToast();

    const { execute, isExecuting } = useAction(importCards, {
        onSuccess: ({ data }) => {
            if (data && "success" in data) {
                // If we were in analysis mode, show the preview dialog
                if ("preview" in data) {
                    setPreviewFiles((data.preview || []) as any[]);
                    setShowPreviewDialog(true);
                    return;
                }

                // Otherwise, import is complete
                addToast(`Successfully imported ${data.count} cards`, "success");
                setJsonText("");
                setShowPreviewDialog(false);
                onClose();
                router.refresh();
            }
        },
        onError: (error) => {
            addToast("An error occurred during import.", "error");
            console.error(error);
        }
    });

    if (!isOpen) return null;

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            setJsonText(content);
        };
        reader.readAsText(file);
    };

    const onAnalyze = () => {
        if (!jsonText.trim()) {
            addToast("Please paste JSON text or upload a file", "error");
            return;
        }

        try {
            // Basic client-side check
            JSON.parse(jsonText);
            
            execute({ 
                boardId, 
                listId, 
                cardsJson: jsonText,
                isAnalysis: true 
            });
        } catch (err) {
            addToast("Invalid JSON format. Please check your text.", "error");
        }
    };

    const onConfirmImport = (opts: {
        enabledFiles: string[];
        globalColor: string | null;
        globalLabel: string | null;
        globalLabelColor: string | null;
    }) => {
        // Build card overrides
        const cardOverrides: Record<string, any> = {};
        for (const file of previewFiles) {
            if (!opts.enabledFiles.includes(file.name)) {
                cardOverrides[file.name] = { enabled: false };
            }
        }

        execute({
            boardId,
            listId,
            cardsJson: jsonText,
            isAnalysis: false,
            cardOverrides,
            globalColor: opts.globalColor || undefined,
            globalLabel: opts.globalLabel || undefined,
            globalLabelColor: opts.globalLabelColor || undefined,
        });
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex items-center justify-between">
                        <div className="flex items-center gap-x-3">
                            <FileJson className="h-6 w-6 text-blue-600" />
                            <div>
                                <h3 className="font-bold text-neutral-900 text-lg">Import Card(s) JSON</h3>
                                <p className="text-xs text-neutral-600">Paste JSON text or upload a .json file</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition p-1 rounded-full hover:bg-neutral-100">
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="flex items-center gap-x-2">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-x-2 py-3 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-md border-2 border-dashed border-neutral-300 transition text-sm font-medium"
                            >
                                <Upload className="h-4 w-4" />
                                Upload JSON File
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileUpload} 
                                accept=".json" 
                                className="hidden" 
                            />
                        </div>

                        <div className="relative">
                            <textarea
                                value={jsonText}
                                onChange={(e) => setJsonText(e.target.value)}
                                className="w-full h-64 bg-neutral-50 border border-neutral-200 rounded-md p-3 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition outline-none resize-none"
                                placeholder='[ { "title": "Card 1", "description": "Details..." }, ... ]'
                            />
                            {jsonText && (
                                <button 
                                    onClick={() => setJsonText("")}
                                    className="absolute top-2 right-2 p-1 bg-white/80 rounded-md hover:bg-white text-neutral-400 hover:text-red-500 transition shadow-sm border border-neutral-100"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-x-3 pt-2">
                            <button
                                onClick={onClose}
                                className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-md transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onAnalyze}
                                disabled={isExecuting || !jsonText.trim()}
                                className="flex-[2] px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition shadow-md shadow-blue-200 flex items-center justify-center gap-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isExecuting ? "Analyzing..." : <><Search className="h-4 w-4" /> Preview Import</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <IngestPreviewDialog
                boardId={boardId}
                files={previewFiles}
                resolvedFiles={[]}
                isOpen={showPreviewDialog}
                onClose={() => setShowPreviewDialog(false)}
                onConfirm={onConfirmImport}
                isConfirming={isExecuting}
                title="JSON Card Import Preview"
            />
        </>
    );
};
