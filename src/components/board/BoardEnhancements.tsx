"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface BoardEnhancementsProps {
    boardId: string;
}

export const BoardEnhancements = ({ boardId }: BoardEnhancementsProps) => {
    const bgOpacityKey = `board_bg_opacity_${boardId}`;
    const listHeightKey = `board_list_height_${boardId}`;

    const [bgOpacity, setBgOpacity] = useState(0.25);

    // Apply CSS variable for overlay opacity
    useEffect(() => {
        const saved = localStorage.getItem(bgOpacityKey);
        if (saved !== null) {
            const val = parseFloat(saved);
            setBgOpacity(val);
            applyOverlay(val);
        } else {
            applyOverlay(0.25);
        }
    }, [bgOpacityKey]);

    useEffect(() => {
        const saved = localStorage.getItem(listHeightKey);
        const height = saved ? parseInt(saved, 10) : 600;
        document.documentElement.style.setProperty("--list-max-height", `${height}px`);
    }, [listHeightKey]);

    const applyOverlay = (opacity: number) => {
        document.documentElement.style.setProperty("--board-overlay-opacity", String(opacity));
    };

    const onOpacityChange = (val: number) => {
        setBgOpacity(val);
        applyOverlay(val);
        localStorage.setItem(bgOpacityKey, String(val));
    };

    return (
        <>
            {/* Overlay that uses CSS variable */}
            <style>{`
                #board-overlay {
                    background-color: rgba(0, 0, 0, var(--board-overlay-opacity, 0.25));
                }
            `}</style>

            {/* BG Opacity Slider - positioned in the top bar */}
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[50] flex items-center gap-x-2 bg-black/30 backdrop-blur-md rounded-md px-3 py-1.5 border border-white/10 shadow-md">
                <span className="text-white/70 text-xs font-medium whitespace-nowrap">BG Opacity</span>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={bgOpacity}
                    onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                    className="w-28 h-1.5 accent-white cursor-pointer"
                />
                <span className="text-white/60 text-xs w-8">{Math.round(bgOpacity * 100)}%</span>
            </div>
        </>
    );
};
