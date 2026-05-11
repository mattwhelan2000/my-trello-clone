"use client";

import { useRef, useState } from "react";
import { useAction as useSafeAction } from "next-safe-action/hooks";
import { importBoard } from "@/actions/import-board";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud } from "lucide-react";
import { ImportBoardPreviewDialog } from "@/components/modals/ImportBoardPreviewDialog";

export const ImportBoardButton = () => {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string>("");
    const [previewData, setPreviewData] = useState<any | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const { execute, isExecuting } = useSafeAction(importBoard, {
        onSuccess: ({ data }) => {
            if (data && !("error" in data) && data.id) {
                router.push(`/board/${data.id}`);
            } else {
                setError("Failed to import board. Invalid format.");
            }
        },
        onError: (err) => {
            setError("Server Error: Unable to import board.");
            console.error(err);
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError("");
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);

                // Do basic validation before sending to the server
                if (!json.title || !Array.isArray(json.lists)) {
                    setError("Invalid JSON format for Board.");
                    return;
                }

                setPreviewData(json);
                setIsDialogOpen(true);
            } catch (err) {
                setError("Failed to parse JSON file.");
            }
        };
        reader.readAsText(file);

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="w-full">
            <input
                type="file"
                accept=".json"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
                disabled={isExecuting}
            />

            <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isExecuting}
                className="w-full bg-white hover:bg-neutral-50 border shadow-sm text-neutral-700 font-medium py-2.5 px-4 rounded-md transition duration-200 flex items-center justify-center gap-x-2 h-11 disabled:opacity-50"
            >
                {isExecuting ? (
                    <Loader2 className="h-5 w-5 animate-spin text-neutral-500" />
                ) : (
                    <>
                        <UploadCloud className="h-5 w-5 text-neutral-500" />
                        <span className="text-sm">Import JSON Board</span>
                    </>
                )}
            </button>
            {error && (
                <p className="text-xs text-red-500 mt-2 text-center">{error}</p>
            )}

            <ImportBoardPreviewDialog
                isOpen={isDialogOpen}
                onClose={() => {
                    setIsDialogOpen(false);
                    setPreviewData(null);
                }}
                onConfirm={(selectedListIds) => {
                    if (previewData) {
                        const filteredData = {
                            ...previewData,
                            lists: previewData.lists.filter((l: any) => selectedListIds.includes(l.id || l.title))
                        };
                        execute(filteredData);
                    }
                }}
                isConfirming={isExecuting}
                boardData={previewData}
            />
        </div>
    );
};
