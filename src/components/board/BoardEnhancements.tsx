"use client";

import { useEffect } from "react";

interface BoardEnhancementsProps {
    boardId: string;
}

export const BoardEnhancements = ({ boardId }: BoardEnhancementsProps) => {
    const bgOpacityKey = `board_bg_opacity_${boardId}`;
    const listHeightKey = `board_list_height_${boardId}`;

    // Initialize CSS variables from localStorage on mount
    useEffect(() => {
        const savedOpacity = localStorage.getItem(bgOpacityKey);
        const opacity = savedOpacity !== null ? parseFloat(savedOpacity) : 0.25;
        document.documentElement.style.setProperty("--board-overlay-opacity", String(opacity));
    }, [bgOpacityKey]);

    useEffect(() => {
        const saved = localStorage.getItem(listHeightKey);
        const height = saved ? parseInt(saved, 10) : 600;
        document.documentElement.style.setProperty("--list-max-height", `${height}px`);
    }, [listHeightKey]);

    return (
        <>
            <style>{`
                #board-overlay {
                    background-color: rgba(0, 0, 0, var(--board-overlay-opacity, 0.25));
                }
            `}</style>
        </>
    );
};
