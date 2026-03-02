"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => { } });

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = "success") => {
        const id = Math.random().toString(36).slice(2);
        setToasts((prev) => [...prev, { id, message, type }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            {/* Toast Container */}
            <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-y-2 pointer-events-none">
                {toasts.map((toast) => (
                    <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem = ({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [isLeaving, setIsLeaving] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => setIsVisible(true));
        const timer = setTimeout(() => {
            setIsLeaving(true);
            setTimeout(() => onRemove(toast.id), 300);
        }, 3000);
        return () => clearTimeout(timer);
    }, [toast.id, onRemove]);

    const Icon = toast.type === "success" ? CheckCircle : toast.type === "error" ? AlertCircle : Info;
    const colors = {
        success: "bg-emerald-600 border-emerald-500",
        error: "bg-red-600 border-red-500",
        info: "bg-blue-600 border-blue-500",
    };

    return (
        <div
            className={`pointer-events-auto flex items-center gap-x-2 px-4 py-3 rounded-lg shadow-xl border text-white text-sm font-medium min-w-[280px] transition-all duration-300 ${colors[toast.type]} ${isVisible && !isLeaving ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}
        >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">{toast.message}</span>
            <button
                onClick={() => { setIsLeaving(true); setTimeout(() => onRemove(toast.id), 300); }}
                className="hover:bg-white/20 p-0.5 rounded transition flex-shrink-0"
            >
                <X className="h-3 w-3" />
            </button>
        </div>
    );
};
