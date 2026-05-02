"use client";

import { useState, useRef, ElementRef } from "react";
import { 
    X, 
    Tag, 
    Clock, 
    CheckSquare, 
    Paperclip, 
    Trash2, 
    Eye, 
    EyeOff, 
    MinusSquare, 
    Maximize2,
    Layout,
    AlertTriangle,
    CheckCircle2,
    Move
} from "lucide-react";

import { useAction } from "next-safe-action/hooks";
import { updateCardsBatch } from "@/actions/update-cards-batch";
import { useToast } from "@/components/ui/Toast";
import { useBoardStore } from "@/hooks/use-board-store";

interface BatchCardPropertiesModalProps {
    isOpen: boolean;
    onClose: () => void;
    cardIds: string[];
    boardId: string;
}

const CARD_COLORS = [
    "#ef4444", "#f97316", "#f59e0b", "#10b981", "#3b82f6", 
    "#6366f1", "#8b5cf6", "#d946ef", "#000000", "#ffffff"
];

export const BatchCardPropertiesModal = ({
    isOpen,
    onClose,
    cardIds,
    boardId,
}: BatchCardPropertiesModalProps) => {
    const { addToast } = useToast();
    const { uniqueLabels } = useBoardStore();

    const [rank, setRank] = useState<number | "">("");
    const [selectedLabels, setSelectedLabels] = useState<Set<{title: string, color: string}>>(new Set());
    const [dueDate, setDueDate] = useState<string | null>(null);
    const [url, setUrl] = useState("");
    const [displayThumbnails, setDisplayThumbnails] = useState<boolean | null>(null);
    const [isSlim, setIsSlim] = useState<boolean | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const { execute, isExecuting: isLoading } = useAction(updateCardsBatch, {
        onSuccess: ({ data }) => {
            if (data && "success" in data) {
                addToast(`Successfully updated ${cardIds.length} cards`, "success");
                onClose();
            }
        },
        onError: ({ error }) => {
            const msg = error.serverError || "Failed to update cards batch.";
            addToast(msg, "error");
        }
    });


    const onApply = (options: any = {}) => {
        execute({
            ids: cardIds,
            boardId,
            ...options
        });
    };

    const toggleLabel = (label: {title: string, color: string}) => {
        const next = new Set(selectedLabels);
        const exists = Array.from(next).find(l => l.title === label.title && l.color === label.color);
        if (exists) next.delete(exists);
        else next.add(label);
        setSelectedLabels(next);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-neutral-900 text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-x-3">
                        <Layout className="h-6 w-6 text-blue-400" />
                        <div>
                            <h2 className="font-bold text-lg leading-tight">Batch Card Properties</h2>
                            <p className="text-xs text-neutral-400">Updating {cardIds.length} visible cards</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white transition">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 max-h-[80vh] overflow-y-auto">
                    {/* Left Column: Properties */}
                    <div className="space-y-6">
                        {/* Rank */}
                        <div>
                            <div className="flex items-center gap-x-2 mb-2">
                                <Move className="h-4 w-4 text-neutral-500" />
                                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Set Rank</h3>
                            </div>
                            <div className="flex items-center gap-x-3 bg-neutral-50 p-3 rounded-lg border">
                                <span className="text-xs font-bold text-neutral-400">#</span>
                                <input 
                                    type="number"
                                    min="1"
                                    placeholder="Enter rank..."
                                    value={rank}
                                    onChange={(e) => setRank(e.target.value ? parseInt(e.target.value) : "")}
                                    className="flex-1 bg-transparent border-none outline-none text-sm font-bold"
                                />
                                <button 
                                    onClick={() => rank && onApply({ rank })}
                                    disabled={!rank || isLoading}
                                    className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
                                >
                                    APPLY RANK
                                </button>
                            </div>
                        </div>

                        {/* Labels */}
                        <div>
                            <div className="flex items-center gap-x-2 mb-2">
                                <Tag className="h-4 w-4 text-neutral-500" />
                                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Add Labels</h3>
                            </div>
                            <div className="bg-neutral-50 p-3 rounded-lg border space-y-3">
                                <div className="flex flex-wrap gap-1.5">
                                    {uniqueLabels.map(label => {
                                        const isSelected = Array.from(selectedLabels).some(l => l.title === label.title && l.color === label.color);
                                        return (
                                            <button
                                                key={label.title}
                                                onClick={() => toggleLabel(label)}
                                                className={`text-[10px] font-bold px-2 py-1 rounded border transition flex items-center gap-x-1.5 ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-500 bg-white' : 'bg-white/50 border-neutral-200 hover:border-neutral-300'}`}
                                            >
                                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: label.color }} />
                                                {label.title}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button 
                                    onClick={() => selectedLabels.size > 0 && onApply({ labels: Array.from(selectedLabels) })}
                                    disabled={selectedLabels.size === 0 || isLoading}
                                    className="w-full bg-indigo-600 text-white text-[10px] font-bold px-3 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition"
                                >
                                    ADD {selectedLabels.size} LABELS
                                </button>
                            </div>
                        </div>

                        {/* Date */}
                        <div>
                            <div className="flex items-center gap-x-2 mb-2">
                                <Clock className="h-4 w-4 text-neutral-500" />
                                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Set Due Date</h3>
                            </div>
                            <div className="flex flex-col gap-y-2 bg-neutral-50 p-3 rounded-lg border">
                                <input 
                                    type="date"
                                    onChange={(e) => setDueDate(e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : null)}
                                    className="w-full bg-white border px-3 py-1.5 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex gap-x-2 mt-1">
                                    <button 
                                        onClick={() => onApply({ dueDate })}
                                        disabled={isLoading}
                                        className="flex-1 bg-neutral-900 text-white text-[10px] font-bold py-2 rounded-md hover:bg-black transition"
                                    >
                                        SET DATE
                                    </button>
                                    <button 
                                        onClick={() => onApply({ dueDate: null })}
                                        disabled={isLoading}
                                        className="flex-1 bg-neutral-200 text-neutral-700 text-[10px] font-bold py-2 rounded-md hover:bg-neutral-300 transition"
                                    >
                                        CLEAR DATE
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Actions */}
                    <div className="space-y-6">
                        {/* Display Controls */}
                        <div>
                            <div className="flex items-center gap-x-2 mb-2">
                                <Eye className="h-4 w-4 text-neutral-500" />
                                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Display Settings</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={() => onApply({ displayThumbnails: true })}
                                    className="flex items-center justify-center gap-x-2 bg-neutral-100 hover:bg-neutral-200 p-3 rounded-lg text-[10px] font-bold transition border border-neutral-200"
                                >
                                    <Eye className="h-4 w-4" /> SHOW THUMBS
                                </button>
                                <button 
                                    onClick={() => onApply({ displayThumbnails: false })}
                                    className="flex items-center justify-center gap-x-2 bg-neutral-100 hover:bg-neutral-200 p-3 rounded-lg text-[10px] font-bold transition border border-neutral-200"
                                >
                                    <EyeOff className="h-4 w-4" /> HIDE THUMBS
                                </button>
                                <button 
                                    onClick={() => onApply({ isSlim: true })}
                                    className="flex items-center justify-center gap-x-2 bg-neutral-100 hover:bg-neutral-200 p-3 rounded-lg text-[10px] font-bold transition border border-neutral-200"
                                >
                                    <MinusSquare className="h-4 w-4" /> ENABLE SLIM
                                </button>
                                <button 
                                    onClick={() => onApply({ isSlim: false })}
                                    className="flex items-center justify-center gap-x-2 bg-neutral-100 hover:bg-neutral-200 p-3 rounded-lg text-[10px] font-bold transition border border-neutral-200"
                                >
                                    <Maximize2 className="h-4 w-4" /> EXIT SLIM
                                </button>
                            </div>
                        </div>

                        {/* Attachments & Content */}
                        <div className="space-y-3">
                             <div className="flex items-center gap-x-2 mb-2">
                                <Paperclip className="h-4 w-4 text-neutral-500" />
                                <h3 className="text-sm font-bold text-neutral-700 uppercase tracking-wider">Bulk Content</h3>
                            </div>
                            <div className="bg-neutral-50 p-3 rounded-lg border space-y-3">
                                <input 
                                    placeholder="Attach URL to all..."
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    className="w-full bg-white border px-3 py-1.5 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button 
                                    onClick={() => url && onApply({ url })}
                                    disabled={!url || isLoading}
                                    className="w-full bg-neutral-900 text-white text-[10px] font-bold py-2 rounded-md hover:bg-black transition"
                                >
                                    ATTACH URL
                                </button>
                                <button 
                                    onClick={() => onApply({ addChecklist: true })}
                                    disabled={isLoading}
                                    className="w-full bg-neutral-100 text-neutral-700 text-[10px] font-bold py-2 rounded-md hover:bg-neutral-200 transition border flex items-center justify-center gap-x-2"
                                >
                                    <CheckSquare className="h-3.5 w-3.5" /> ADD CHECKLIST
                                </button>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="pt-4 border-t border-red-100">
                             {!isDeleting ? (
                                <button 
                                    onClick={() => setIsDeleting(true)}
                                    className="w-full bg-red-50 hover:bg-red-100 text-red-600 p-3 rounded-lg text-[10px] font-bold transition border border-red-200 flex items-center justify-center gap-x-2"
                                >
                                    <Trash2 className="h-4 w-4" /> DELETE ALL VISIBLE CARDS
                                </button>
                             ) : (
                                <div className="bg-red-600 text-white p-4 rounded-lg space-y-3 animate-in fade-in zoom-in duration-200">
                                    <div className="flex items-center gap-x-2">
                                        <AlertTriangle className="h-5 w-5" />
                                        <span className="font-bold text-xs uppercase tracking-tight">Are you absolutely sure?</span>
                                    </div>
                                    <p className="text-[10px] leading-relaxed opacity-90">This will permanently delete all {cardIds.length} cards currently visible on your board. This action cannot be undone.</p>
                                    <div className="flex gap-x-2">
                                        <button 
                                            onClick={() => onApply({ delete: true })}
                                            className="flex-1 bg-white text-red-600 text-[10px] font-bold py-2 rounded-md hover:bg-neutral-100 transition"
                                        >
                                            YES, DELETE
                                        </button>
                                        <button 
                                            onClick={() => setIsDeleting(false)}
                                            className="flex-1 bg-red-700 text-white text-[10px] font-bold py-2 rounded-md hover:bg-red-800 transition"
                                        >
                                            CANCEL
                                        </button>
                                    </div>
                                </div>
                             )}
                        </div>
                    </div>
                </div>

                {/* Footer Status */}
                {isLoading && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                        <div className="flex flex-col items-center gap-y-2">
                            <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-bold text-blue-700">Updating Board...</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
