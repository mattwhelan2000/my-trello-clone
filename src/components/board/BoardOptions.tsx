"use client";

import { useState } from "react";
import { Settings, Image as ImageIcon, Palette, X, Download, Info, LayoutList, CreditCard } from "lucide-react";
import { useAction } from "@/hooks/use-action";
import { useAction as useSafeAction } from "next-safe-action/hooks";
import { updateBoard } from "@/actions/update-board";
import { exportBoard } from "@/actions/export-board";
import { useToast } from "@/components/ui/Toast";

interface BoardOptionsProps {
    boardId: string;
    listsCount: number;
    cardsCount: number;
}

const COLORS = [
    "#334155", "#475569", "#1e293b", "#27272a", "#18181b",
    "#52525b", "#262626", "#171717", "#525252", "#1c1917",
    "#292524", "#57534e", "#4338ca", "#0f172a"
];

function boardToCSV(board: any): string {
    const rows: string[][] = [];
    rows.push(["List", "Card Title", "Description", "Due Date", "Labels", "Checklists"]);
    for (const list of board.lists || []) {
        for (const card of list.cards || []) {
            rows.push([
                list.title,
                card.title,
                card.description || "",
                card.dueDate ? new Date(card.dueDate).toLocaleDateString() : "",
                (card.labels || []).map((l: any) => l.title).join("; "),
                (card.checklists || []).map((cl: any) => {
                    const done = cl.items.filter((i: any) => i.isCompleted).length;
                    return `${cl.title} (${done}/${cl.items.length})`;
                }).join("; "),
            ]);
        }
    }
    return rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
}

export const BoardOptions = ({ boardId, listsCount, cardsCount }: BoardOptionsProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [imageUrl, setImageUrl] = useState("");
    const { addToast } = useToast();

    const { execute, isLoading } = useAction(updateBoard, {
        onSuccess: () => { setIsOpen(false); },
        onError: (error) => console.error(error)
    });

    const { execute: executeExport, isExecuting: isExporting } = useSafeAction(exportBoard, {
        onSuccess: ({ data }) => {
            if (data && !("error" in data) && data.title) {
                const jsonString = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonString], { type: "application/json" });
                const href = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = href;
                link.download = `board-${data.title.replace(/\s+/g, '-').toLowerCase()}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                addToast("Board exported as JSON", "success");
                setIsOpen(false);
            }
        },
        onError: (error) => console.error("Export failed", error)
    });

    const { execute: executeExportCSV, isExecuting: isExportingCSV } = useSafeAction(exportBoard, {
        onSuccess: ({ data }) => {
            if (data && !("error" in data) && data.title) {
                const csv = boardToCSV(data);
                const blob = new Blob([csv], { type: "text/csv" });
                const href = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = href;
                link.download = `board-${data.title.replace(/\s+/g, '-').toLowerCase()}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                addToast("Board exported as CSV", "success");
                setIsOpen(false);
            }
        },
        onError: (error) => console.error("CSV Export failed", error)
    });

    const onColorSelect = (color: string) => {
        execute({ id: boardId, bgColor: color, bgImage: "" });
    };

    const onImageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!imageUrl) return;
        execute({ id: boardId, bgImage: imageUrl, bgColor: "" });
    };

    const anyLoading = isLoading || isExporting || isExportingCSV;

    return (
        <div className="absolute top-4 right-4 z-[50] flex items-center gap-x-2">
            <div className="hidden md:flex items-center gap-x-4 bg-black/40 text-white rounded-md px-4 py-1.5 text-sm font-medium backdrop-blur-md shadow-sm border border-white/20 mr-2 font-mono">
                <div className="flex items-center gap-x-1.5" title="Total Lists">
                    <LayoutList className="h-4 w-4 opacity-80" />
                    <span>{listsCount}</span>
                </div>
                <div className="w-[1px] h-4 bg-white/20" />
                <div className="flex items-center gap-x-1.5" title="Total Cards">
                    <CreditCard className="h-4 w-4 opacity-80" />
                    <span>{cardsCount}</span>
                </div>
            </div>
            <button
                onClick={() => {
                    setIsInfoOpen(!isInfoOpen);
                    setIsOpen(false);
                }}
                className="bg-black/20 hover:bg-black/30 text-white rounded-md px-3 py-1.5 flex items-center gap-x-2 text-sm font-medium backdrop-blur-sm transition"
            >
                <Info className="h-4 w-4" />
                Controls
            </button>
            <button
                onClick={() => {
                    setIsOpen(!isOpen);
                    setIsInfoOpen(false);
                }}
                className="bg-black/20 hover:bg-black/30 text-white rounded-md px-3 py-1.5 flex items-center gap-x-2 text-sm font-medium backdrop-blur-sm transition"
            >
                <Settings className="h-4 w-4" />
                Board Settings
            </button>

            {isInfoOpen && (
                <div className="absolute top-10 right-0 w-80 bg-white rounded-md shadow-lg border p-4 text-neutral-800">
                    <div className="flex items-center justify-between mb-4 border-b pb-2">
                        <span className="font-semibold text-sm">Page Controls</span>
                        <button onClick={() => setIsInfoOpen(false)} className="text-neutral-500 hover:bg-neutral-100 p-1 rounded-sm">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <ul className="text-sm space-y-3 text-neutral-600">
                        <li className="flex items-start gap-x-2">
                            <span className="bg-neutral-200 px-1.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap">MMB + Drag</span>
                            <span>Pan the board left, right, up, and down.</span>
                        </li>
                        <li className="flex items-start gap-x-2">
                            <span className="bg-neutral-200 px-1.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap">Double Click</span>
                            <span>Open a card to see its full details and actions.</span>
                        </li>
                        <li className="flex items-start gap-x-2">
                            <span className="bg-neutral-200 px-1.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap">Right Click</span>
                            <span>Open the quick-action menu on a card (Duplicate, Delete, Copy).</span>
                        </li>
                        <li className="flex items-start gap-x-2">
                            <span className="bg-neutral-200 px-1.5 py-0.5 rounded text-xs font-semibold whitespace-nowrap">Ctrl + V</span>
                            <span>Paste images, text, or iframes directly onto a list to create a card.</span>
                        </li>
                    </ul>
                </div>
            )}

            {isOpen && (
                <div className="absolute top-10 right-0 w-80 bg-white rounded-md shadow-lg border p-4 text-neutral-800">
                    <div className="flex items-center justify-between mb-4 border-b pb-2">
                        <span className="font-semibold text-sm">Background Customization</span>
                        <button onClick={() => setIsOpen(false)} className="text-neutral-500 hover:bg-neutral-100 p-1 rounded-sm">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="mb-4">
                        <h4 className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-x-1"><Palette className="h-3 w-3" /> Solid Colors</h4>
                        <div className="grid grid-cols-7 gap-1">
                            {COLORS.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => onColorSelect(color)}
                                    className="h-8 w-8 rounded-sm hover:opacity-80 transition cursor-pointer border border-black/10 shadow-sm"
                                    style={{ backgroundColor: color }}
                                    disabled={anyLoading}
                                />
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-x-1"><ImageIcon className="h-3 w-3" /> Image URL</h4>
                        <form onSubmit={onImageSubmit} className="flex flex-col gap-y-2 mb-4">
                            <input
                                value={imageUrl}
                                onChange={(e) => setImageUrl(e.target.value)}
                                placeholder="Paste image URL here..."
                                className="text-sm px-2 py-1.5 border rounded-sm outline-none focus:ring-1 focus:ring-blue-600 w-full"
                                disabled={anyLoading}
                            />
                            <button type="submit" disabled={anyLoading} className="bg-blue-600 text-white w-full rounded-sm text-sm font-medium py-1.5 hover:bg-blue-700 transition">
                                Set Image
                            </button>
                        </form>
                    </div>

                    <div className="pt-2 border-t flex flex-col gap-y-2">
                        <button
                            onClick={() => executeExport({ id: boardId })}
                            disabled={anyLoading}
                            className="bg-neutral-200 text-neutral-700 w-full rounded-sm text-sm font-medium py-1.5 hover:bg-neutral-300 transition flex items-center justify-center gap-x-2"
                        >
                            <Download className="h-4 w-4" />
                            {isExporting ? "Exporting..." : "Export as JSON"}
                        </button>
                        <button
                            onClick={() => executeExportCSV({ id: boardId })}
                            disabled={anyLoading}
                            className="bg-neutral-200 text-neutral-700 w-full rounded-sm text-sm font-medium py-1.5 hover:bg-neutral-300 transition flex items-center justify-center gap-x-2"
                        >
                            <Download className="h-4 w-4" />
                            {isExportingCSV ? "Exporting..." : "Export as CSV"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
