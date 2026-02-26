"use client";

import { useState, useEffect, useRef } from "react";
import { useEventListener } from "usehooks-ts";

export const BoardCanvas = ({
    children,
    boardId,
}: {
    children: React.ReactNode;
    boardId: string;
}) => {
    const [isMounted, setIsMounted] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const onKeyDown = (e: KeyboardEvent) => {
        // Prevent triggering shortcuts if modifying text inputs
        if (["INPUT", "TEXTAREA", "FORM"].includes((e.target as HTMLElement).tagName)) {
            return;
        }

        if (e.key === "n") {
            // New shortcut logic here
            console.log("Triggered 'New' shortcut");
        } else if (e.key === "c") {
            // Archive/Close
            console.log("Triggered 'Archive' shortcut");
        } else if (e.key === " ") {
            // Space binding
            console.log("Triggered 'Space' shortcut");
        }
    };

    useEventListener("keydown", onKeyDown);

    if (!isMounted) return null; // Prevent hydration errors for DnD

    const handleMouseDown = (e: React.MouseEvent) => {
        // Prevent drag scrolling if we're clicking on a card or list header
        const target = e.target as HTMLElement;
        if (target.closest('[role="button"]') || target.closest('button') || target.closest('input') || target.closest('textarea')) {
            return;
        }

        setIsDragging(true);
        if (!scrollContainerRef.current) return;
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
        setScrollLeft(scrollContainerRef.current.scrollLeft);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX) * 2; // The multiplier dictates scroll speed
        scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    };

    return (
        <div
            ref={scrollContainerRef}
            className={`flex flex-row h-full overflow-x-auto overflow-y-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
        >
            {children}
        </div>
    );
};
