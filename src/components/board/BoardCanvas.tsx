"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

    // Use refs instead of state for drag tracking to avoid re-renders on every mouse move
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const startYRef = useRef(0);
    const scrollLeftRef = useRef(0);
    const scrollTopRef = useRef(0);
    const rafRef = useRef<number | null>(null);

    // Only this one uses state because it affects the rendered cursor class
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

    const handleMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('[role="button"]') || target.closest('button') || target.closest('input') || target.closest('textarea')) {
            return;
        }

        isDraggingRef.current = true;
        setCursorStyle("grabbing");
        if (!scrollContainerRef.current) return;
        startXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
        startYRef.current = e.pageY;
        scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
        scrollTopRef.current = window.scrollY;
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

        // Cancel any pending animation frame to avoid stacking
        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        const pageX = e.pageX;
        const pageY = e.pageY;

        rafRef.current = requestAnimationFrame(() => {
            if (!scrollContainerRef.current) return;
            const x = pageX - scrollContainerRef.current.offsetLeft;
            const walkX = (x - startXRef.current) * 1.5;
            const walkY = (pageY - startYRef.current) * 1.5;
            scrollContainerRef.current.scrollLeft = scrollLeftRef.current - walkX;
            window.scrollTo({ top: scrollTopRef.current - walkY, behavior: "instant" as ScrollBehavior });
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
