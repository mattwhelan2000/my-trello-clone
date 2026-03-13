"use client";

import Link from "next/link";
import { LayoutDashboard, Plus, ChevronLeft } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

export const Navbar = () => {
    const pathname = usePathname();
    const boardIdMatch = pathname?.match(/\/board\/([^/]+)/);
    const boardId = boardIdMatch ? boardIdMatch[1] : null;

    const bgOpacityKey = boardId ? `board_bg_opacity_${boardId}` : null;

    const [bgOpacity, setBgOpacity] = useState(0.25);
    const [isOnBoard, setIsOnBoard] = useState(false);
    const [boardTitle, setBoardTitle] = useState<string | null>(null);

    useEffect(() => {
        setIsOnBoard(!!boardId);
        if (bgOpacityKey) {
            const saved = localStorage.getItem(bgOpacityKey);
            const val = saved !== null ? parseFloat(saved) : 0.25;
            setBgOpacity(val);
            document.documentElement.style.setProperty("--board-overlay-opacity", String(val));
        }
        if (boardId) {
            fetch(`/api/boards/${boardId}`)
                .then((res) => res.ok ? res.json() : null)
                .then((data) => setBoardTitle(data?.title ?? null))
                .catch(() => setBoardTitle(null));
        } else {
            setBoardTitle(null);
        }
    }, [bgOpacityKey, boardId]);

    const onOpacityChange = useCallback((val: number) => {
        setBgOpacity(val);
        document.documentElement.style.setProperty("--board-overlay-opacity", String(val));
        if (bgOpacityKey) {
            localStorage.setItem(bgOpacityKey, String(val));
        }
    }, [bgOpacityKey]);

    return (
        <nav className="fixed z-50 top-0 px-4 w-full h-14 border-b border-white/10 shadow-sm bg-black/60 backdrop-blur-sm flex items-center">
            <div className="flex items-center gap-x-4">
                {/* Back / Main Menu button — only shown on board pages */}
                {isOnBoard && (
                    <Link href="/">
                        <button className="flex items-center gap-x-1 text-white/80 hover:text-white hover:bg-white/10 transition px-2 py-1.5 rounded-md text-sm font-medium">
                            <ChevronLeft className="h-4 w-4" />
                            <span className="hidden md:block">Main Menu</span>
                        </button>
                    </Link>
                )}

                <div className="hidden md:flex">
                    <Link href="/">
                        <div className="hover:opacity-75 transition items-center gap-x-2 hidden md:flex cursor-pointer">
                            <div className="bg-blue-600 p-1 rounded-sm">
                                <LayoutDashboard className="h-5 w-5 text-white" />
                            </div>
                            <p className="text-lg text-white font-bold pb-1 text-center">
                                {isOnBoard && boardTitle ? boardTitle : "Trello Clone"}
                            </p>
                        </div>
                    </Link>
                </div>

                {!isOnBoard && (
                    <div className="flex items-center gap-x-2">
                        <Link href="/">
                            <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition h-auto md:block">
                                <span className="md:hidden">
                                    <Plus className="h-4 w-4" />
                                </span>
                                <span className="hidden md:block">Create</span>
                            </button>
                        </Link>
                    </div>
                )}
            </div>
            <div className="ml-auto flex items-center gap-x-3">
                <Link href="/workflows">
                    <button className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-md text-sm font-medium transition backdrop-blur-sm">
                        Workflows
                    </button>
                </Link>
                {isOnBoard && (
                    <div className="flex items-center gap-x-2">
                        <span className="text-white/60 text-xs font-medium whitespace-nowrap">BG Opacity</span>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={bgOpacity}
                            onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                            className="w-24 h-1.5 accent-white cursor-pointer"
                        />
                        <span className="text-white/50 text-xs w-7 text-right">{Math.round(bgOpacity * 100)}%</span>
                    </div>
                )}
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold cursor-pointer text-sm">
                    U
                </div>
            </div>
        </nav>
    );
};
