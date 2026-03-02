"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, children }: ModalProps) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
            document.body.classList.add("modal-open");
        }
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "auto";
            document.body.classList.remove("modal-open");
        };
    }, [isOpen, onClose]);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-20 overflow-y-auto"
            style={{ pointerEvents: 'auto' }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div
                className="fixed inset-0"
                onClick={onClose}
            />
            <div
                ref={modalRef}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-[#f4f5f7] rounded-xl w-full max-w-3xl mb-20 shadow-xl"
            >
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-2 rounded-full hover:bg-black/10 transition z-10"
                >
                    <X className="h-5 w-5 text-neutral-600" />
                </button>
                {children}
            </div>
        </div>,
        document.body
    );
};
