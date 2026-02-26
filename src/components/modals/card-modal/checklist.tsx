"use client";

import { CheckSquare } from "lucide-react";
import { useState, useRef, ElementRef, KeyboardEventHandler } from "react";
import { useAction } from "@/hooks/use-action";
import { createChecklistItem } from "@/actions/create-checklist-item";

interface ChecklistProps {
    data: any; // The checklist object
    boardId: string;
}

export const Checklist = ({ data, boardId }: ChecklistProps) => {
    const [isAddingItem, setIsAddingItem] = useState(false);
    const formRef = useRef<ElementRef<"form">>(null);
    const inputRef = useRef<ElementRef<"input">>(null);

    const { execute, isLoading } = useAction(createChecklistItem, {
        onSuccess: () => {
            setIsAddingItem(false);
        },
        onError: (error) => {
            console.error(error);
        }
    });

    const enableEditing = () => {
        setIsAddingItem(true);
        setTimeout(() => {
            inputRef.current?.focus();
        });
    };

    const disableEditing = () => {
        setIsAddingItem(false);
        if (inputRef.current) inputRef.current.value = "";
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") disableEditing();
    };

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const title = formData.get("title") as string;

        if (!title.trim()) return;

        execute({ title: title.trim(), checklistId: data.id, boardId });
    };

    // Calculate Progress
    const itemsLength = data.items?.length || 0;
    const completedItems = data.items?.filter((item: any) => item.isCompleted).length || 0;
    const percentage = itemsLength === 0 ? 0 : Math.round((completedItems / itemsLength) * 100);

    return (
        <div className="flex items-start gap-x-3 w-full mb-6">
            <CheckSquare className="h-6 w-6 text-neutral-700 mt-1" />
            <div className="w-full">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-neutral-700 mt-1">{data.title}</h3>
                    <button className="bg-[#e9eaec] text-sm px-3 py-1.5 rounded-sm hover:bg-[#dcdfe4]">Delete</button>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-x-3 mt-4 mb-3">
                    <span className="text-xs text-neutral-500 w-8">{percentage}%</span>
                    <div className="w-full h-2 bg-neutral-200 rounded-full">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${percentage === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                </div>

                {/* Checklist Items */}
                <div className="flex flex-col gap-y-2 mb-3">
                    {data.items?.map((item: any) => (
                        <div key={item.id} className="flex items-start gap-x-3 group hover:bg-neutral-100 p-1 -ml-1 rounded-sm">
                            <input
                                type="checkbox"
                                checked={item.isCompleted}
                                readOnly
                                className="mt-1 h-3.5 w-3.5 cursor-pointer accent-blue-600"
                            />
                            <p className={`text-sm ${item.isCompleted ? 'line-through text-neutral-500' : 'text-neutral-700'}`}>{item.title}</p>
                        </div>
                    ))}
                </div>

                {/* Add Item Form */}
                {isAddingItem ? (
                    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-y-2 mt-2">
                        <input
                            ref={inputRef}
                            name="title"
                            id="title"
                            className="text-sm px-3 py-2 border rounded-md font-medium border-neutral-300 focus:outline-none focus:ring-1 focus:ring-blue-600 hover:bg-neutral-50 transition w-full"
                            placeholder="Add an item"
                        />
                        <div className="flex items-center gap-x-2">
                            <button type="submit" disabled={isLoading} className="bg-blue-600 text-white rounded-md text-sm font-medium px-4 py-2 hover:bg-blue-700 transition">Add</button>
                            <button type="button" onClick={disableEditing} className="px-3 py-2 text-sm hover:bg-neutral-100 rounded-md">Cancel</button>
                        </div>
                    </form>
                ) : (
                    <button onClick={enableEditing} className="bg-[#e9eaec] text-sm px-3 py-1.5 rounded-sm hover:bg-[#dcdfe4] mt-1">Add an item</button>
                )}

            </div>
        </div>
    );
};
