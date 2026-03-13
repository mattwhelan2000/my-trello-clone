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
        <form onSubmit={onSubmit} className="w-full h-11 flex flex-row items-center gap-x-2 bg-white rounded-md shadow-sm border p-1">
            <input
                required
                className="px-3 py-1.5 text-sm w-full bg-transparent focus:outline-none focus:ring-0 text-neutral-800"
                placeholder="New board title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isExecuting}
            />
            <button
                disabled={isExecuting || !title.trim()}
                type="submit"
                className="h-full shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 opacity-90 hover:opacity-100 rounded transition duration-200 flex items-center justify-center disabled:opacity-50"
            >
                {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </button>
        </form>
    );
};
