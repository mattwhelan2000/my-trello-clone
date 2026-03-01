"use client";

import { CheckSquare, X } from "lucide-react";
import { useState, useRef, ElementRef, useEffect, useTransition } from "react";
import { updateChecklistItem } from "@/actions/update-checklist-item";
import { deleteChecklist } from "@/actions/delete-checklist";
import { deleteChecklistItem } from "@/actions/delete-checklist-item";
import { createChecklistItem } from "@/actions/create-checklist-item";

interface ChecklistProps {
    data: any;
    boardId: string;
}

export const Checklist = ({ data, boardId }: ChecklistProps) => {
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [isPending, startTransition] = useTransition();
    const inputRef = useRef<ElementRef<"input">>(null);

    // Optimistic local state for items
    const [localItems, setLocalItems] = useState<any[]>(data.items || []);

    // Sync when server data changes
    useEffect(() => {
        setLocalItems(data.items || []);
    }, [data.items]);

    const handleToggleItem = async (item: any) => {
        const newValue = !item.isCompleted;
        // Optimistic update
        setLocalItems(prev =>
            prev.map(i => i.id === item.id ? { ...i, isCompleted: newValue } : i)
        );
        // Fire server action directly
        try {
            await updateChecklistItem({ id: item.id, boardId, isCompleted: newValue });
        } catch (err) {
            console.error("Failed to toggle item:", err);
            // Revert on error
            setLocalItems(prev =>
                prev.map(i => i.id === item.id ? { ...i, isCompleted: !newValue } : i)
            );
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        // Optimistic update
        setLocalItems(prev => prev.filter(i => i.id !== itemId));
        try {
            await deleteChecklistItem({ id: itemId, boardId });
        } catch (err) {
            console.error("Failed to delete item:", err);
        }
    };

    const handleDeleteChecklist = async () => {
        try {
            await deleteChecklist({ id: data.id, boardId });
        } catch (err) {
            console.error("Failed to delete checklist:", err);
        }
    };

    const handleAddItem = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const title = formData.get("title") as string;
        if (!title?.trim()) return;

        try {
            await createChecklistItem({ title: title.trim(), checklistId: data.id, boardId });
            setIsAddingItem(false);
        } catch (err) {
            console.error("Failed to add item:", err);
        }
    };

    const enableEditing = () => {
        setIsAddingItem(true);
        setTimeout(() => inputRef.current?.focus());
    };

    // Progress
    const total = localItems.length;
    const completed = localItems.filter((i: any) => i.isCompleted).length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

    return (
        <div className="flex items-start gap-x-3 w-full mb-6">
            <CheckSquare className="h-6 w-6 text-neutral-700 mt-1" />
            <div className="w-full">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-neutral-700 mt-1">{data.title}</h3>
                    <button
                        onClick={handleDeleteChecklist}
                        className="bg-[#e9eaec] text-sm px-3 py-1.5 rounded-sm hover:bg-[#dcdfe4]"
                    >
                        Delete
                    </button>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-x-3 mt-4 mb-3">
                    <span className="text-xs text-neutral-500 w-8">{pct}%</span>
                    <div className="w-full h-2 bg-neutral-200 rounded-full">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${pct === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                </div>

                {/* Checklist Items */}
                <div className="flex flex-col gap-y-1 mb-3">
                    {localItems.map((item: any) => (
                        <div key={item.id} className="flex items-center gap-x-2 py-1.5 px-1 rounded-sm hover:bg-neutral-100 group">
                            <input
                                type="checkbox"
                                checked={item.isCompleted}
                                onChange={() => handleToggleItem(item)}
                                className="h-4 w-4 cursor-pointer accent-blue-600 shrink-0"
                                style={{ minWidth: '16px', minHeight: '16px' }}
                            />
                            <span className={`text-sm flex-1 ${item.isCompleted ? 'line-through text-neutral-400' : 'text-neutral-700'}`}>
                                {item.title}
                            </span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    handleDeleteItem(item.id);
                                }}
                                className="text-neutral-400 hover:text-red-500 hover:bg-neutral-200 rounded-sm p-0.5 transition shrink-0"
                                title="Delete item"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Add Item */}
                {isAddingItem ? (
                    <form onSubmit={handleAddItem} className="flex flex-col gap-y-2 mt-2">
                        <input
                            ref={inputRef}
                            name="title"
                            className="text-sm px-3 py-2 border rounded-md font-medium border-neutral-300 focus:outline-none focus:ring-1 focus:ring-blue-600 hover:bg-neutral-50 transition w-full"
                            placeholder="Add an item"
                        />
                        <div className="flex items-center gap-x-2">
                            <button type="submit" className="bg-blue-600 text-white rounded-md text-sm font-medium px-4 py-2 hover:bg-blue-700 transition">Add</button>
                            <button type="button" onClick={() => setIsAddingItem(false)} className="px-3 py-2 text-sm hover:bg-neutral-100 rounded-md">Cancel</button>
                        </div>
                    </form>
                ) : (
                    <button onClick={enableEditing} className="bg-[#e9eaec] text-sm px-3 py-1.5 rounded-sm hover:bg-[#dcdfe4] mt-1">Add an item</button>
                )}
            </div>
        </div>
    );
};
