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

    // Use refs for drag tracking to avoid re-renders
    const isDraggingRef = useRef(false);
    const startXRef = useRef(0);
    const scrollLeftRef = useRef(0);
    const rafRef = useRef<number | null>(null);

    const [cursorStyle, setCursorStyle] = useState<"grab" | "grabbing" | "default">("grab");

    // Track if a modal is open reactively
    const [isModalVisible, setIsModalVisible] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Watch for modal appearing/disappearing in the DOM
    useEffect(() => {
        const checkModal = () => {
            const hasModal = !!document.querySelector('.fixed.inset-0.z-50');
            setIsModalVisible(hasModal);
        };

        const observer = new MutationObserver(checkModal);
        observer.observe(document.body, { childList: true, subtree: true });
        checkModal(); // initial check

        return () => observer.disconnect();
    }, []);

    // Update cursor when modal state changes
    useEffect(() => {
        if (isModalVisible) {
            setCursorStyle("default");
            isDraggingRef.current = false;
        } else {
            setCursorStyle("grab");
        }
    }, [isModalVisible]);

    const onKeyDown = useCallback((e: KeyboardEvent) => {
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
    }, []);

    useEventListener("keydown", onKeyDown);


    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        // Don't start drag if a modal is open
        if (isModalVisible) return;

        const target = e.target as HTMLElement;

        // Prevent panning if clicking inside interactive elements
        if (target.closest('[role="button"]') || target.closest('button') || target.closest('input') || target.closest('textarea')) {
            return;
        }

        // Only allow panning on MMB (button 1) OR LMB (button 0) directly on the background (id="board-content" or the canvas itself)
        const isMiddleClick = e.button === 1;
        const isLeftClick = e.button === 0;
        const isBackground = target === scrollContainerRef.current || target.id === 'board-content';

        if (!isMiddleClick && !(isLeftClick && isBackground)) {
            return;
        }

        isDraggingRef.current = true;
        setCursorStyle("grabbing");
        if (!scrollContainerRef.current) return;
        startXRef.current = e.pageX - scrollContainerRef.current.offsetLeft;
        scrollLeftRef.current = scrollContainerRef.current.scrollLeft;
    }, [isModalVisible]);

    const handleMouseLeave = useCallback(() => {
        isDraggingRef.current = false;
        if (!isModalVisible) setCursorStyle("grab");
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }, [isModalVisible]);

    const handleMouseUp = useCallback(() => {
        isDraggingRef.current = false;
        if (!isModalVisible) setCursorStyle("grab");
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }, [isModalVisible]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDraggingRef.current || !scrollContainerRef.current || isModalVisible) return;
        e.preventDefault();

        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        const pageX = e.pageX;

        rafRef.current = requestAnimationFrame(() => {
            if (!scrollContainerRef.current) return;
            const x = pageX - scrollContainerRef.current.offsetLeft;
            const walkX = (x - startXRef.current) * 1.5;
            // Reversed direction: '+' instead of '-'
            scrollContainerRef.current.scrollLeft = scrollLeftRef.current + walkX;
        });
    }, [isModalVisible]);

    const getCursorClass = () => {
        if (cursorStyle === "grabbing") return "cursor-grabbing";
        if (cursorStyle === "grab") return "cursor-grab";
        return "cursor-default";
    };

    if (!isMounted) return null;

    return (
        <div
            ref={scrollContainerRef}
            className={`flex flex-row overflow-x-scroll overflow-y-auto board-canvas-scroller ${getCursorClass()}`}
            style={{ 
                minHeight: 'calc(100vh - 6rem)',
                overscrollBehaviorX: 'contain'
            }}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
        >
            {children}
        </div>
    );
};
