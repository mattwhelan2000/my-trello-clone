"use client";

import Link from "next/link";
import { LayoutDashboard, Plus, ChevronLeft, X, Camera } from "lucide-react";
import { useBoardStore } from "@/hooks/use-board-store";
import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { useOnClickOutside } from "usehooks-ts";
import { CreateBoardForm } from "@/components/board/CreateBoardForm";

export const Navbar = () => {
    const pathname = usePathname();
    const boardIdMatch = pathname?.match(/\/board\/([^/]+)/);
    const boardId = boardIdMatch ? boardIdMatch[1] : null;
    const [isMounted, setIsMounted] = useState(false);
    
    useEffect(() => {
        setIsMounted(true);
    }, []);
    const { triggerSnapshotSave, triggerSnapshotLoad } = useBoardStore();

    if (!isMounted) return null;

    const bgOpacityKey = boardId ? `board_bg_opacity_${boardId}` : null;

    const [bgOpacity, setBgOpacity] = useState(0.25);
    const [isOnBoard, setIsOnBoard] = useState(false);
    const [boardTitle, setBoardTitle] = useState<string | null>(null);

    const [isCreating, setIsCreating] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    useOnClickOutside(popoverRef as any, () => setIsCreating(false));

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
                            <p className="text-lg text-white font-bold pb-1 text-center flex items-center gap-x-2">
                                {isOnBoard && boardTitle ? boardTitle : "Trello Clone"}
                                <span className="bg-green-500/20 text-green-400 text-[10px] px-1.5 py-0.5 rounded border border-green-500/30 font-medium tracking-wider">
                                    GCP
                                </span>
                            </p>
                        </div>
                    </Link>
                </div>

                {!isOnBoard && (
                    <div className="flex items-center gap-x-2 relative" ref={popoverRef}>
                        <button 
                            onClick={() => setIsCreating(!isCreating)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition h-auto md:block">
                            <span className="md:hidden">
                                <Plus className="h-4 w-4" />
                            </span>
                            <span className="hidden md:block">Create</span>
                        </button>
                        {isCreating && (
                            <div className="absolute top-full left-0 mt-2 w-72 bg-white shadow-xl border rounded-md p-3 z-50">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-sm font-medium text-neutral-600">Create Board</div>
                                    <button onClick={() => setIsCreating(false)} className="text-neutral-500 hover:text-neutral-800 transition">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <CreateBoardForm />
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="ml-auto flex items-center gap-x-3">
                {isOnBoard && (
                    <div className="flex items-center gap-x-1 mr-1">
                        <button
                            onClick={triggerSnapshotSave}
                            title="Save Slim Mode Snapshot"
                            className="flex flex-col items-center gap-y-0.5 p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition group"
                        >
                            <Camera className="h-4 w-4" />
                            <span className="text-[8px] font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition">Save</span>
                        </button>
                        <button
                            onClick={triggerSnapshotLoad}
                            title="Load Slim Mode Snapshot"
                            className="flex flex-col items-center gap-y-0.5 p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition border border-white/20 group"
                        >
                            <div className="relative">
                                <Camera className="h-4 w-4" />
                                <div className="absolute -top-1 -right-1 h-2 w-2 bg-blue-500 rounded-full border border-black/50" />
                            </div>
                            <span className="text-[8px] font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition">Load</span>
                        </button>
                    </div>
                )}

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
