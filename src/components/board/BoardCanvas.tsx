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

    // Use refs for drag tracking to avoid re-renders
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const scrollLeftRef = useRef(0);
    const rafRef = useRef<number | null>(null);

    const [cursorStyle, setCursorStyle] = useState<"grab" | "grabbing">("grab");

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const onKeyDown = (e: KeyboardEvent) => {
        if (["INPUT", "TEXTAREA", "FORM"].includes((e.target as HTMLElement).tagName)) {
            return;
        }
        if (e.key === "n") {
            console.log("Triggered 'New' shortcut");
        } else if (e.key === "c") {
            console.log("Triggered 'Archive' shortcut");
        } else if (e.key === " ") {
            console.log("Triggered 'Space' shortcut");
        }
    };

    useEventListener("keydown", onKeyDown);

    if (!isMounted) return null;

    const isModalOpen = () => {
        // Check if any modal overlay is present in the DOM
        return !!document.querySelector('.fixed.inset-0.z-50');
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        // Don't start drag if a modal is open
        if (isModalOpen()) return;

        const target = e.target as HTMLElement;
        if (target.closest('[role="button"]') || target.closest('button') || target.closest('input') || target.closest('textarea')) {
            return;
        }

        isDraggingRef.current = true;
        setCursorStyle("grabbing");
        if (!scrollContainerRef.current) return;
        startXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
        scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
    };

    const handleMouseLeave = () => {
        isDraggingRef.current = false;
        setCursorStyle("grab");
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
        setCursorStyle("grab");
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current || !scrollContainerRef.current) return;
        e.preventDefault();

        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        const pageX = e.pageX;

        rafRef.current = requestAnimationFrame(() => {
            if (!scrollContainerRef.current) return;
            const x = pageX - scrollContainerRef.current.offsetLeft;
            const walkX = (x - startXRef.current) * 1.5;
            scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walkX;
        });
    };

    return (
        <div
            ref={scrollContainerRef}
            className={`flex flex-row overflow-x-auto overflow-y-auto ${cursorStyle === "grabbing" ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ minHeight: 'calc(100vh - 6rem)' }}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
        >
            {children}
        </div>
    );
};
