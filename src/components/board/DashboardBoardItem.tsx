"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, X, Palette, Image as ImageIcon, Type } from "lucide-react";
import { useAction as useSafeAction } from "next-safe-action/hooks";
import { updateBoard } from "@/actions/update-board";
import { Board } from "@prisma/client";

interface DashboardBoardItemProps {
    board: Board;
}

const COLORS = [
    "#334155", "#475569", "#1e293b", "#27272a", "#18181b",
    "#52525b", "#262626", "#171717", "#525252", "#1c1917",
    "#292524", "#57534e", "#4338ca", "#0f172a"
];

export const DashboardBoardItem = ({ board }: DashboardBoardItemProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [imageUrl, setImageUrl] = useState("");
    const [title, setTitle] = useState(board.title);

    const { execute, isExecuting } = useSafeAction(updateBoard, {
        onSuccess: () => {
            // Success handles through revalidatePath in the action
        },
        onError: (error) => {
            console.error(error);
        }
    });

    const onColorSelect = (color: string) => {
        execute({ id: board.id, bgColor: color, bgImage: "" });
    };

    const onImageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!imageUrl) return;
        execute({ id: board.id, bgImage: imageUrl, bgColor: "" });
        setImageUrl("");
    };

    const onRenameSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!title || title === board.title) return;
        execute({ id: board.id, title });
    };

    return (
        <div className="group relative h-64 w-full shadow-sm rounded-sm">
            <div
                className="absolute inset-0 rounded-sm overflow-hidden"
                style={{ backgroundColor: board.bgColor || "white" }}
            >
                {board.bgImage && (
                    <img
                        src={board.bgImage}
                        alt=""
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                )}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition z-10" />
            </div>

            <Link href={`/board/${board.id}`} className="absolute inset-0 z-[1]">
                <span className="sr-only">Go to {board.title}</span>
            </Link>

            <div className="relative z-10 flex items-start justify-between p-2">
                <p className="font-bold text-white shadow-sm break-words px-1 mt-1 truncate pointer-events-none">
                    {board.title}
                </p>

                <div className="relative">
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsOpen(!isOpen);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition text-white hover:bg-white/20 p-1 rounded-sm"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {isOpen && (
                        <div
                            className="absolute top-full right-0 mt-1 w-64 bg-white rounded-md shadow-lg border p-4 text-neutral-800 z-50 cursor-default"
                            onClick={(e) => e.stopPropagation()} // Prevent closing when interacting with menu
                        >
                            <div className="flex items-center justify-between mb-4 border-b pb-2">
                                <span className="font-semibold text-sm">Board Settings</span>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="text-neutral-500 hover:bg-neutral-100 p-1 rounded-sm"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="mb-4">
                                <h4 className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-x-1">
                                    <Type className="h-3 w-3" /> Rename Board
                                </h4>
                                <form onSubmit={onRenameSubmit} className="flex flex-col gap-y-2">
                                    <input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Board Title..."
                                        className="text-sm px-2 py-1.5 border rounded-sm outline-none focus:ring-1 focus:ring-blue-600 w-full"
                                        disabled={isExecuting}
                                    />
                                    <button
                                        type="submit"
                                        disabled={isExecuting || title === board.title || !title}
                                        className="bg-blue-600 text-white w-full rounded-sm text-xs font-medium py-1.5 hover:bg-blue-700 transition"
                                    >
                                        Rename
                                    </button>
                                </form>
                            </div>

                            <div className="mb-4">
                                <h4 className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-x-1">
                                    <Palette className="h-3 w-3" /> Solid Colors
                                </h4>
                                <div className="grid grid-cols-7 gap-1">
                                    {COLORS.map((color) => (
                                        <button
                                            key={color}
                                            onClick={() => onColorSelect(color)}
                                            className="h-6 w-6 rounded-sm hover:opacity-80 transition cursor-pointer border border-black/10 shadow-sm"
                                            style={{ backgroundColor: color }}
                                            disabled={isExecuting}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-x-1">
                                    <ImageIcon className="h-3 w-3" /> Image URL
                                </h4>
                                <form onSubmit={onImageSubmit} className="flex flex-col gap-y-2">
                                    {board.bgImage && (
                                        <div className="w-full h-12 rounded-sm border overflow-hidden relative" style={{ backgroundColor: board.bgColor || "white" }}>
                                            <img
                                                src={board.bgImage}
                                                alt=""
                                                referrerPolicy="no-referrer"
                                                crossOrigin="anonymous"
                                                className="absolute inset-0 w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <input
                                        value={imageUrl}
                                        onChange={(e) => setImageUrl(e.target.value)}
                                        placeholder="Paste image URL here..."
                                        className="text-sm px-2 py-1.5 border rounded-sm outline-none focus:ring-1 focus:ring-blue-600 w-full"
                                        disabled={isExecuting}
                                    />
                                    <button
                                        type="submit"
                                        disabled={isExecuting || !imageUrl}
                                        className="bg-neutral-200 text-neutral-700 hover:bg-neutral-300 w-full rounded-sm text-xs font-medium py-1.5 transition"
                                    >
                                        Set Image
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
