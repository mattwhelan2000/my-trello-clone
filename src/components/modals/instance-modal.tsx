"use client";

import { Modal } from "@/components/modals/Modal";
import { useBoardStore } from "@/hooks/use-board-store";
import { useState, useEffect } from "react";
import { Check, Copy, Hash, List } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { instanceCard } from "@/actions/instance-card";
import { useToast } from "@/components/ui/Toast";
import { useRouter } from "next/navigation";

interface InstanceModalProps {
    card: any;
    boardId: string;
    isOpen: boolean;
    onClose: () => void;
}

export const InstanceModal = ({ card, boardId, isOpen, onClose }: InstanceModalProps) => {
    const boardLists = useBoardStore((state) => state.boardLists);
    const [selectedLists, setSelectedLists] = useState<Set<string>>(new Set());
    const [position, setPosition] = useState<string>("1");
    const [isMounted, setIsMounted] = useState(false);
    const router = useRouter();
    const { addToast } = useToast();

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const { execute, isExecuting } = useAction(instanceCard, {
        onSuccess: ({ data }) => {
            if (data?.success) {
                addToast(`Successfully instanced card in ${data.count} lists`, "success");
                onClose();
                router.refresh();
            }
        },
        onError: (error) => {
            addToast("Failed to instance card", "error");
            console.error(error);
        }
    });

    const toggleList = (id: string) => {
        const next = new Set(selectedLists);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedLists(next);
    };

    const onInstance = () => {
        execute({
            id: card.id,
            boardId,
            listIds: Array.from(selectedLists),
            position: parseInt(position) || undefined
        });
    };

    if (!isMounted) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="p-6">
                <div className="flex items-center gap-x-3 mb-6">
                    <div className="p-2 bg-blue-100 rounded-lg">
                        <Copy className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-neutral-800">Instance Card</h2>
                        <p className="text-sm text-neutral-500">Create synced instances of "{card.title}"</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 block">
                            Target Lists
                        </label>
                        <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {boardLists.map((list) => (
                                <button
                                    key={list.id}
                                    onClick={() => toggleList(list.id)}
                                    className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${
                                        selectedLists.has(list.id)
                                            ? "border-blue-600 bg-blue-50 text-blue-900"
                                            : "border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700"
                                    }`}
                                >
                                    <div className="flex items-center gap-x-2 truncate">
                                        <List className="h-4 w-4 shrink-0 opacity-50" />
                                        <span className="text-sm font-semibold truncate">{list.title}</span>
                                    </div>
                                    <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                                        selectedLists.has(list.id) ? "bg-blue-600 border-blue-600 text-white" : "border-neutral-300"
                                    }`}>
                                        {selectedLists.has(list.id) && <Check className="h-3 w-3" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bg-neutral-100 p-4 rounded-xl border border-neutral-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-x-2">
                                <div className="p-1.5 bg-white rounded-md border border-neutral-200">
                                    <Hash className="h-4 w-4 text-neutral-500" />
                                </div>
                                <label className="text-sm font-bold text-neutral-700">List Position</label>
                            </div>
                            <input
                                type="number"
                                min="1"
                                value={position}
                                onChange={(e) => setPosition(e.target.value)}
                                className="w-20 px-3 py-2 border-2 border-neutral-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none transition-all"
                            />
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-2 italic flex items-center gap-x-1.5">
                            <span className="h-1 w-1 rounded-full bg-neutral-400" />
                            Example: "3" will place the card as the 3rd item from the top in each selected list.
                        </p>
                    </div>
                </div>

                <div className="mt-8 flex items-center gap-x-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 rounded-xl font-bold text-neutral-600 hover:bg-neutral-200 transition"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={selectedLists.size === 0 || isExecuting}
                        onClick={onInstance}
                        className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white px-4 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 transition flex items-center justify-center gap-x-2"
                    >
                        {isExecuting ? (
                            "Instancing..."
                        ) : (
                            <>
                                <Copy className="h-4 w-4" />
                                Create {selectedLists.size} Instance{selectedLists.size === 1 ? "" : "s"}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
