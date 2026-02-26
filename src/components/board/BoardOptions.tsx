"use client";

import { useState } from "react";
import { Settings, Image as ImageIcon, Palette, X } from "lucide-react";
import { useAction } from "@/hooks/use-action";
import { updateBoard } from "@/actions/update-board";

interface BoardOptionsProps {
    boardId: string;
}

const COLORS = [
    "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
    "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899",
    "#000000", "#ffffff", "#475569", "#78716c"
];

export const BoardOptions = ({ boardId }: BoardOptionsProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [imageUrl, setImageUrl] = useState("");

    const { execute, isLoading } = useAction(updateBoard, {
        onSuccess: () => {
            setIsOpen(false);
        },
        onError: (error) => {
            console.error(error);
        }
    });

    const onColorSelect = (color: string) => {
        execute({ id: boardId, bgColor: color, bgImage: "" });
    };

    const onImageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!imageUrl) return;
        execute({ id: boardId, bgImage: imageUrl, bgColor: "" });
    };

    return (
        <div className="absolute top-4 right-4 z-[50]">
            <button
                onClick={() => setIsOpen(true)}
                className="bg-black/20 hover:bg-black/30 text-white rounded-md px-3 py-1.5 flex items-center gap-x-2 text-sm font-medium backdrop-blur-sm transition"
            >
                <Settings className="h-4 w-4" />
                Board Settings
            </button>

            {isOpen && (
                <div className="absolute top-10 right-0 w-80 bg-white rounded-md shadow-lg border p-4 text-neutral-800">
                    <div className="flex items-center justify-between mb-4 border-b pb-2">
                        <span className="font-semibold text-sm">Background Customization</span>
                        <button onClick={() => setIsOpen(false)} className="text-neutral-500 hover:bg-neutral-100 p-1 rounded-sm">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="mb-4">
                        <h4 className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-x-1"><Palette className="h-3 w-3" /> Solid Colors</h4>
                        <div className="grid grid-cols-7 gap-1">
                            {COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => onColorSelect(color)}
                                    className="h-8 w-8 rounded-sm hover:opacity-80 transition cursor-pointer border border-black/10 shadow-sm"
                                    style={{ backgroundColor: color }}
                                    disabled={isLoading}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-x-1"><ImageIcon className="h-3 w-3" /> Image URL</h4>
                        <form onSubmit={onImageSubmit} className="flex flex-col gap-y-2">
                            <input
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                placeholder="Paste image URL here..."
                                className="text-sm px-2 py-1.5 border rounded-sm outline-none focus:ring-1 focus:ring-blue-600 w-full"
                                disabled={isLoading}
                            />
                            <button type="submit" disabled={isLoading} className="bg-blue-600 text-white w-full rounded-sm text-sm font-medium py-1.5 hover:bg-blue-700 transition">
                                Set Image
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
