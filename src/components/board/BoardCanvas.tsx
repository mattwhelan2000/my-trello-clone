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
    const [startY, setStartY] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [scrollTop, setScrollTop] = useState(0);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const onKeyDown = (e: KeyboardEvent) => {
        // Prevent triggering shortcuts if modifying text inputs
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
        if (target.closest('[role="button"]') || target.closest('button') || target.closest('input') || target.closest('textarea') || target.closest('li') || target.closest('ol')) {
            return;
        }

        setIsDragging(true);
        if (!scrollContainerRef.current) return;
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
        setStartY(e.pageY - scrollContainerRef.current.offsetTop);
        setScrollLeft(scrollContainerRef.current.scrollLeft);
        setScrollTop(scrollContainerRef.current.scrollTop);
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
        const y = e.pageY - scrollContainerRef.current.offsetTop;
        const walkX = (x - startX) * 2;
        const walkY = (y - startY) * 2;
        scrollContainerRef.current.scrollLeft = scrollLeft - walkX;
        scrollContainerRef.current.scrollTop = scrollTop - walkY;
    };

    return (
        <div
            ref={scrollContainerRef}
            className={`flex flex-row overflow-x-auto overflow-y-auto ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
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
