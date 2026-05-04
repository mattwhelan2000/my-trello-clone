"use client";

import { useState } from "react";
import { X, FileJson, Copy, CheckSquare, Square } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

interface CopyCardsModalProps {
    listTitle: string;
    cards: any[];
    isOpen: boolean;
    onClose: () => void;
}

export const CopyCardsModal = ({
    listTitle,
    cards,
    isOpen,
    onClose
}: CopyCardsModalProps) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(cards.map(c => c.id)));
    const { addToast } = useToast();

    if (!isOpen) return null;

    const toggleCard = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleAll = () => {
        if (selectedIds.size === cards.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(cards.map(c => c.id)));
    };

    const onCopy = async () => {
        const cardsToExport = cards.filter(c => selectedIds.has(c.id)).map(c => ({
            title: c.title,
            description: c.description,
            color: c.color,
            fontColor: c.fontColor,
            isSlim: c.isSlim,
            displayThumbnails: c.displayThumbnails,
            dueDate: c.dueDate,
            labels: (c.labels || []).map((l: any) => ({ title: l.title, color: l.color })),
            attachments: (c.attachments || []).map((a: any) => ({ 
                url: a.url, 
                type: a.type, 
                title: a.title, 
                thumbnailUrl: a.thumbnailUrl, 
                isCover: a.isCover 
            })),
            checklists: (c.checklists || []).map((cl: any) => ({
                title: cl.title,
                items: (cl.items || []).map((i: any) => ({ title: i.title, isCompleted: i.isCompleted }))
            }))
        }));

        if (cardsToExport.length === 0) {
            addToast("Please select at least one card", "error");
            return;
        }

        try {
            const json = JSON.stringify(cardsToExport, null, 2);
            await navigator.clipboard.writeText(json);
            addToast(`Copied ${cardsToExport.length} cards to clipboard as JSON`, "success");
            onClose();
        } catch (err) {
            addToast("Failed to copy to clipboard", "error");
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="bg-purple-50 px-6 py-4 border-b border-purple-100 flex items-center justify-between">
                    <div className="flex items-center gap-x-3">
                        <FileJson className="h-6 w-6 text-purple-600" />
                        <div>
                            <h3 className="font-bold text-neutral-900 text-lg">Copy Cards (JSON)</h3>
                            <p className="text-xs text-neutral-600">Select cards from "{listTitle}"</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 transition p-1 rounded-full hover:bg-neutral-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-4 bg-neutral-50 border-b flex items-center justify-between">
                    <button 
                        onClick={toggleAll}
                        className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-x-1.5"
                    >
                        {selectedIds.size === cards.length ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                        {selectedIds.size === cards.length ? "Deselect All" : "Select All"}
                    </button>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{selectedIds.size} selected</span>
                </div>

                <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                    {cards.map((card) => (
                        <button
                            key={card.id}
                            onClick={() => toggleCard(card.id)}
                            className={`w-full flex items-center gap-x-3 p-3 rounded-md transition border-2 ${selectedIds.has(card.id) ? "bg-purple-50 border-purple-200" : "bg-white border-transparent hover:bg-neutral-50"}`}
                        >
                            <div className={`shrink-0 h-5 w-5 rounded flex items-center justify-center transition ${selectedIds.has(card.id) ? "bg-purple-600 text-white" : "border-2 border-neutral-300"}`}>
                                {selectedIds.has(card.id) && <CheckSquare className="h-3.5 w-3.5" />}
                            </div>
                            <span className="text-sm font-medium text-neutral-700 truncate">{card.title}</span>
                        </button>
                    ))}
                </div>

                <div className="p-6 border-t flex items-center gap-x-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-md transition"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onCopy}
                        disabled={selectedIds.size === 0}
                        className="flex-[2] px-4 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-md transition shadow-md shadow-purple-200 flex items-center justify-center gap-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Copy className="h-4 w-4" /> Copy JSON
                    </button>
                </div>
            </div>
        </div>
    );
};
