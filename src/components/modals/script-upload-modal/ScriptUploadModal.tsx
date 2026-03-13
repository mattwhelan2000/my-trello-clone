"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Upload, Loader2, FileText } from "lucide-react";

interface ScriptUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ScriptUploadModal = ({ isOpen, onClose }: ScriptUploadModalProps) => {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selected = e.target.files[0];
            if (selected.type !== "application/pdf") {
                setError("Please select a PDF file");
                return;
            }
            setError(null);
            setFile(selected);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const selected = e.dataTransfer.files[0];
            if (selected.type !== "application/pdf") {
                setError("Please drop a PDF file");
                return;
            }
            setError(null);
            setFile(selected);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;
        setIsLoading(true);
        setError(null);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/ingest-script", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok || data.error) {
                setError(data.error || "Failed to ingest script.");
            } else {
                onClose();
                setFile(null);
                router.push(`/board/${data.boardId}`);
            }
        } catch (err: any) {
            setError(err.message || "Unknown error.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold text-neutral-700">Import Script</h2>
                    <button 
                        onClick={onClose}
                        disabled={isLoading}
                        className="text-neutral-500 hover:text-neutral-800 transition rounded-full p-1 hover:bg-neutral-100 disabled:opacity-50"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6">
                    <div 
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        className={`border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center text-center transition ${
                            file ? 'border-blue-500 bg-blue-50/50' : 'border-neutral-300 hover:bg-neutral-50 cursor-pointer'
                        }`}
                        onClick={() => !file && document.getElementById('script-upload')?.click()}
                    >
                        {file ? (
                            <div className="flex flex-col items-center">
                                <div className="p-3 bg-blue-100 rounded-full mb-3 text-blue-600">
                                    <FileText className="h-8 w-8" />
                                </div>
                                <p className="text-sm font-medium text-neutral-800 truncate max-w-[250px]">
                                    {file.name}
                                </p>
                                <p className="text-xs text-neutral-500 mt-1">
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                                    className="text-xs text-red-500 hover:text-red-700 font-medium mt-3"
                                    disabled={isLoading}
                                >
                                    Remove File
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="p-3 bg-neutral-100 rounded-full mb-3 text-neutral-600">
                                    <Upload className="h-8 w-8" />
                                </div>
                                <p className="text-sm font-medium text-neutral-700">
                                    Click or drag PDF here
                                </p>
                                <p className="text-xs text-neutral-500 mt-1">
                                    Must be standard screenplay format
                                </p>
                            </>
                        )}
                        <input 
                            id="script-upload" 
                            type="file" 
                            accept="application/pdf" 
                            className="hidden" 
                            onChange={handleFileChange}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="mt-6 flex justify-end gap-x-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 rounded-md transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!file || isLoading}
                            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md transition disabled:opacity-50 flex items-center gap-x-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Parsing Script...
                                </>
                            ) : (
                                "Ingest Script"
                            )}
                        </button>
                    </div>
                    {error && (
                        <p className="mt-4 text-xs text-center text-red-600 font-medium">{error}</p>
                    )}
                </form>
            </div>
        </div>
    );
};
