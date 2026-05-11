"use client";

import React, { useState } from "react";
import { X, Check, Loader2, List, FileText, CheckSquare, Square, Layers } from "lucide-react";

interface ImportBoardPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (selectedListIds: string[]) => void;
    isConfirming: boolean;
    boardData: any | null;
}

export function ImportBoardPreviewDialog({
    isOpen,
    onClose,
    onConfirm,
    isConfirming,
    boardData
}: ImportBoardPreviewDialogProps) {
    const [disabledLists, setDisabledLists] = useState<Set<string>>(new Set());

    if (!isOpen || !boardData) return null;

    const toggleList = (id: string) => {
        const next = new Set(disabledLists);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setDisabledLists(next);
    };

    const handleConfirm = () => {
        // Return only the list IDs that are NOT disabled
        const selectedIds = boardData.lists
            .filter((l: any) => !disabledLists.has(l.id || l.title))
            .map((l: any) => l.id || l.title);
        onConfirm(selectedIds);
    };

    const totalCards = boardData.lists.reduce((acc: number, list: any) => acc + (list.cards?.length || 0), 0);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-[#f4f5f7] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-[#0079bf] px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-x-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Layers className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Import Board Preview</h2>
                            <p className="text-xs text-blue-100 mt-0.5">
                                {boardData.title} · {boardData.lists.length} Lists · {totalCards} Cards
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    <p className="text-sm text-neutral-600 mb-4">Select the lists you want to import. To prevent memory errors on large boards, deselecting unneeded lists can help.</p>
                    
                    {boardData.lists.map((list: any, i: number) => {
                        const id = list.id || list.title || `list-${i}`;
                        const disabled = disabledLists.has(id);
                        
                        return (
                            <div key={id} className={`flex items-center justify-between p-3 rounded-lg border transition ${disabled ? "bg-neutral-100 border-neutral-200 opacity-50" : "bg-white border-neutral-200 shadow-sm"}`}>
                                <div className="flex items-center gap-x-3">
                                    <button onClick={() => toggleList(id)} className="focus:outline-none">
                                        {disabled ? <Square className="h-4 w-4 text-neutral-400" /> : <CheckSquare className="h-4 w-4 text-[#0079bf]" />}
                                    </button>
                                    <List className="h-4 w-4 text-neutral-500" />
                                    <span className={`font-semibold text-sm ${disabled ? "line-through text-neutral-500" : "text-neutral-800"}`}>
                                        {list.title}
                                    </span>
                                </div>
                                <div className="flex items-center gap-x-1.5 text-xs font-medium text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full">
                                    <FileText className="h-3.5 w-3.5" />
                                    {list.cards?.length || 0} cards
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="border-t bg-white px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="text-xs text-neutral-500">
                        Selected: {boardData.lists.length - disabledLists.size} of {boardData.lists.length} lists
                    </div>
                    <div className="flex items-center gap-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isConfirming || (boardData.lists.length - disabledLists.size) === 0}
                            className="px-6 py-2 text-sm font-bold text-white bg-[#0079bf] hover:bg-[#026aa7] rounded-lg transition shadow-md flex items-center gap-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isConfirming ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Importing...</>
                            ) : (
                                <><Check className="h-4 w-4" /> Import Selected</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
