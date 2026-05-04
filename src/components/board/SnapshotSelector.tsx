"use client";

import React, { useState, useEffect } from "react";
import { Camera, Plus, Trash, Check, X, ChevronRight, Loader2 } from "lucide-react";
import { useAction as useSafeAction } from "next-safe-action/hooks";
import { createSnapshot } from "@/actions/create-snapshot";
import { applySnapshot } from "@/actions/apply-snapshot";
import { deleteSnapshot } from "@/actions/delete-snapshot";
import { useToast } from "@/components/ui/Toast";
import { useBoardStore } from "@/hooks/use-board-store";

interface SnapshotSelectorProps {
    boardId: string;
}

export const SnapshotSelector = ({ boardId }: SnapshotSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [snapshots, setSnapshots] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { addToast } = useToast();
    const { boardLists } = useBoardStore();

    const fetchSnapshots = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/boards/${boardId}/snapshots`);
            if (res.ok) {
                const data = await res.json();
                setSnapshots(data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchSnapshots();
        }
    }, [isOpen]);

    const { execute: executeCreate, isExecuting: isCreating } = useSafeAction(createSnapshot, {
        onSuccess: () => {
            addToast("Snapshot saved", "success");
            setTitle("");
            fetchSnapshots();
        },
        onError: () => addToast("Failed to save snapshot", "error")
    });

    const { execute: executeApply, isExecuting: isApplying } = useSafeAction(applySnapshot, {
        onSuccess: () => {
            addToast("Snapshot applied", "success");
            setIsOpen(false);
            window.location.reload(); // Hard refresh to ensure all card states are updated in the UI
        },
        onError: () => addToast("Failed to apply snapshot", "error")
    });

    const { execute: executeDelete, isExecuting: isDeleting } = useSafeAction(deleteSnapshot, {
        onSuccess: () => {
            addToast("Snapshot deleted", "success");
            fetchSnapshots();
        },
        onError: () => addToast("Failed to delete snapshot", "error")
    });

    const onSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        executeCreate({ boardId, title });
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-x-1.5 px-3 py-1.5 rounded-md border backdrop-blur-sm transition shadow-lg text-sm font-medium ${isOpen ? 'bg-purple-600 border-purple-400 text-white' : 'bg-black/20 border-white/20 text-white hover:bg-black/30'}`}
                title="Board Snapshots (Slim Mode & Thumbnails)"
            >
                <Camera className="h-3.5 w-3.5" />
                <span>Snapshot</span>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-2xl border border-neutral-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[110]">
                    <div className="px-4 py-3 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Snapshots</span>
                            <span className="text-[9px] text-purple-400 leading-tight">Save card visibility states</span>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-purple-400 hover:text-purple-600 transition">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="p-3 border-b border-neutral-100 bg-neutral-50/50">
                        <form onSubmit={onSave} className="flex flex-col gap-y-2">
                            <div className="relative">
                                <input 
                                    autoFocus
                                    placeholder="e.g. VFX Review, Slim View"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full text-xs px-2.5 py-2 border rounded-md outline-none focus:ring-1 focus:ring-purple-600 text-neutral-900 pr-10"
                                    disabled={isCreating}
                                />
                                <button 
                                    type="submit"
                                    disabled={isCreating || !title.trim()}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition"
                                >
                                    {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                </button>
                            </div>
                            <p className="text-[9px] text-neutral-400 text-center uppercase font-bold tracking-tighter">Saves Slim Mode & Thumbnail states for all cards</p>
                        </form>
                    </div>

                    <div className="max-h-[300px] overflow-y-auto">
                        {isLoading && snapshots.length === 0 ? (
                            <div className="py-8 flex flex-col items-center justify-center text-neutral-400 gap-y-2">
                                <Loader2 className="h-5 w-5 animate-spin opacity-20" />
                                <span className="text-[10px] uppercase font-bold tracking-widest">Loading...</span>
                            </div>
                        ) : snapshots.length === 0 ? (
                            <div className="py-8 flex flex-col items-center justify-center text-neutral-400 gap-y-2">
                                <Camera className="h-8 w-8 opacity-10" />
                                <span className="text-[10px] uppercase font-bold tracking-widest">No Snapshots Saved</span>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {snapshots.map((snapshot) => (
                                    <div 
                                        key={snapshot.id}
                                        className="group flex items-center justify-between px-3 py-2.5 hover:bg-purple-50 transition border-b border-neutral-50 last:border-0"
                                    >
                                        <div 
                                            className="flex flex-col flex-1 cursor-pointer"
                                            onClick={() => executeApply({ boardId, snapshotId: snapshot.id })}
                                        >
                                            <span className="text-xs font-bold text-neutral-700 group-hover:text-purple-700 transition flex items-center gap-x-2">
                                                {snapshot.title}
                                                {isApplying && <Loader2 className="h-3 w-3 animate-spin text-purple-500" />}
                                            </span>
                                            <span className="text-[9px] text-neutral-400 uppercase font-medium">
                                                {new Date(snapshot.createdAt).toLocaleDateString()} • {snapshot.data?.length || 0} cards
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-x-1 opacity-0 group-hover:opacity-100 transition">
                                            <button 
                                                onClick={() => executeApply({ boardId, snapshotId: snapshot.id })}
                                                className="p-1.5 text-purple-600 hover:bg-purple-100 rounded-md transition"
                                                title="Apply Snapshot"
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                            </button>
                                            <button 
                                                onClick={() => executeDelete({ boardId, snapshotId: snapshot.id })}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition"
                                                title="Delete"
                                            >
                                                <Trash className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
