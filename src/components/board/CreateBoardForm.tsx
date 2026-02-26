"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { createBoard } from "@/actions/create-board";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export const CreateBoardForm = () => {
    const router = useRouter();
    const [title, setTitle] = useState("");

    const { execute, isExecuting } = useAction(createBoard, {
        onSuccess: ({ data }) => {
            if (data && !("error" in data) && data.id) {
                router.push(`/board/${data.id}`);
            }
        },
    });

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (title.trim()) {
            execute({ title });
        }
    };

    return (
        <form onSubmit={onSubmit} className="w-full flex flex-col gap-y-2">
            <input
                required
                className="px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                placeholder="Board title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isExecuting}
            />
            <button
                disabled={isExecuting || !title.trim()}
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200 flex items-center justify-center disabled:opacity-50"
            >
                {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </button>
        </form>
    );
};
