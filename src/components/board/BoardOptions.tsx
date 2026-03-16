"use client";

import React, { useState } from "react";
import { Settings, Image as ImageIcon, Palette, X, Download, Info, LayoutList, CreditCard } from "lucide-react";
import { useAction } from "@/hooks/use-action";
import { useAction as useSafeAction } from "next-safe-action/hooks";
import { updateBoard } from "@/actions/update-board";
import { exportBoard } from "@/actions/export-board";
import { syncGoogleSheet } from "@/actions/sync-google-sheet";
import { pushGoogleSheet } from "@/actions/push-google-sheet";
import { updateListColors } from "@/actions/update-list-colors";
import { useToast } from "@/components/ui/Toast";

interface BoardOptionsProps {
    boardId: string;
    listsCount: number;
    cardsCount: number;
    initialGoogleSheetId?: string | null;
    colorSwatches?: string[];
    listColorSwatches?: string[];
}

const COLORS = [
    "#334155", "#475569", "#1e293b", "#27272a", "#18181b",
    "#52525b", "#262626", "#171717", "#525252", "#1c1917",
    "#292524", "#57534e", "#4338ca", "#0f172a"
];

const LIST_COLORS = [
    "#3b82f6", "#ec4899", "#8b5cf6", "#10b981", "#f59e0b",
    "#ef4444", "#06b6d4", "#0ea5e9", "#64748b", "#84cc16"
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

export const BoardOptions = ({ boardId, listsCount, cardsCount, initialGoogleSheetId, colorSwatches, listColorSwatches }: BoardOptionsProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [imageUrl, setImageUrl] = useState("");
    const [sheetId, setSheetId] = useState(initialGoogleSheetId || "");
    const { addToast } = useToast();

    // Local state for swatches so they update immediately
    const [currentBgColors, setCurrentBgColors] = useState(colorSwatches?.length ? colorSwatches : COLORS);
    const [currentListColors, setCurrentListColors] = useState(listColorSwatches?.length ? listColorSwatches : LIST_COLORS);

    // Editing state
    const [editingSwatch, setEditingSwatch] = useState<{ type: 'bg' | 'list', index: number } | null>(null);
    const colorInputRef = React.useRef<HTMLInputElement>(null);

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

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editingSwatch) return;
        const newColor = e.target.value;
        if (editingSwatch.type === 'bg') {
            const newColors = [...currentBgColors];
            newColors[editingSwatch.index] = newColor;
            setCurrentBgColors(newColors);
            execute({ id: boardId, colorSwatches: newColors });
        } else {
            const newColors = [...currentListColors];
            newColors[editingSwatch.index] = newColor;
            setCurrentListColors(newColors);
            execute({ id: boardId, listColorSwatches: newColors });
        }
    };

    const handleContextMenu = (e: React.MouseEvent, type: 'bg' | 'list', index: number) => {
        e.preventDefault();
        setEditingSwatch({ type, index });
        // Need a tiny delay for state to update before clicking the ref
        setTimeout(() => {
            colorInputRef.current?.click();
        }, 50);
    };

    const onColorSelect = (color: string) => {
        execute({ id: boardId, bgColor: color, bgImage: "" });
    };

    const onImageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!imageUrl) return;
        execute({ id: boardId, bgImage: imageUrl, bgColor: "" });
    };

    const onSheetSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Extract ID from URL if user pastes a full URL
        let finalId = sheetId;
        const urlMatch = sheetId.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (urlMatch) {
            finalId = urlMatch[1];
        }
        execute({ id: boardId, googleSheetId: finalId });
        setSheetId(finalId);
    };

    const { execute: executeSync, isExecuting: isSyncing } = useSafeAction(syncGoogleSheet, {
        onSuccess: ({ data }) => {
            if (data && "success" in data) {
                addToast("Google Sheet Synced successfully", "success");
                setIsOpen(false);
            } else if (data && "error" in data) {
                addToast(data.error as string, "error");
            }
        },
        onError: (error) => {
            console.error("Sync failed", error);
            addToast("A network error occurred during sync.", "error");
        }
    });

    const { execute: executePush, isExecuting: isPushing } = useSafeAction(pushGoogleSheet, {
        onSuccess: ({ data }) => {
            if (data && "success" in data) {
                addToast("Board pushed to Google Sheet successfully", "success");
                setIsOpen(false);
            } else if (data && "error" in data) {
                addToast(data.error as string, "error");
            }
        },
        onError: (error) => {
            console.error("Push failed", error);
            addToast("A network error occurred during push.", "error");
        }
    });

    const { execute: executeUpdateListsColors, isLoading: isUpdatingListsColors } = useAction(updateListColors, {
        onSuccess: (data) => {
            addToast("All list colors updated", "success");
            setIsOpen(false);
        },
        onError: (error) => {
            console.error(error);
            addToast("Failed to update list colors", "error");
        }
    });

    const anyLoading = isLoading || isExporting || isExportingCSV || isSyncing || isPushing || isUpdatingListsColors;

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
                        <h4 className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-x-1"><Palette className="h-3 w-3" /> Solid Colors (Right-Click to Edit)</h4>
                        <div className="grid grid-cols-7 gap-1">
                            {currentBgColors.map((color, idx) => (
                                <button
                                    key={`bg-${idx}`}
                                    onClick={() => onColorSelect(color)}
                                    onContextMenu={(e) => handleContextMenu(e, 'bg', idx)}
                                    className="h-8 w-8 rounded-sm hover:opacity-80 transition cursor-pointer border border-black/10 shadow-sm"
                                    style={{ backgroundColor: color }}
                                    disabled={anyLoading}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="mb-4">
                        <h4 className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-x-1"><LayoutList className="h-3 w-3" /> List Colors (Right-Click to Edit)</h4>
                        <div className="grid grid-cols-5 gap-1">
                            {currentListColors.map((color, idx) => (
                                <button
                                    key={`list-${idx}`}
                                    onClick={() => executeUpdateListsColors({ boardId, color })}
                                    onContextMenu={(e) => handleContextMenu(e, 'list', idx)}
                                    className="h-8 w-full rounded-sm hover:opacity-80 transition cursor-pointer border border-black/10 shadow-sm"
                                    style={{ backgroundColor: color }}
                                    disabled={anyLoading}
                                />
                            ))}
                        </div>
                    </div>

                    <input 
                        type="color" 
                        ref={colorInputRef} 
                        onChange={handleColorChange} 
                        className="sr-only" 
                        tabIndex={-1} 
                        value={editingSwatch ? (editingSwatch.type === 'bg' ? currentBgColors[editingSwatch.index] : currentListColors[editingSwatch.index]) : "#ffffff"} 
                    />

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

                    <div>
                        <h4 className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-x-1"><LayoutList className="h-3 w-3" /> Google Sheet ID</h4>
                        <form onSubmit={onSheetSubmit} className="flex flex-col gap-y-2 mb-4">
                            <input
                                value={sheetId}
                                onChange={(e) => setSheetId(e.target.value)}
                                placeholder="Paste Sheet URL or ID..."
                                className="text-sm px-2 py-1.5 border rounded-sm outline-none focus:ring-1 focus:ring-green-600 w-full"
                                disabled={anyLoading}
                            />
                            <button type="submit" disabled={anyLoading} className="bg-green-600 text-white w-full rounded-sm text-sm font-medium py-1.5 hover:bg-green-700 transition">
                                Link Sheet
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
                        <button
                            onClick={() => executeSync({ boardId })}
                            disabled={anyLoading || !sheetId}
                            className="bg-green-100 text-green-800 w-full rounded-sm text-sm font-medium py-1.5 hover:bg-green-200 transition flex items-center justify-center gap-x-2"
                        >
                            <LayoutList className="h-4 w-4" />
                            {isSyncing ? "Syncing..." : "Sync from Sheet"}
                        </button>

                        <button
                            onClick={() => executePush({ boardId })}
                            disabled={anyLoading || !sheetId}
                            className="bg-purple-100 text-purple-800 w-full rounded-sm text-sm font-medium py-1.5 hover:bg-purple-200 transition flex items-center justify-center gap-x-2"
                        >
                            <Download className="h-4 w-4" />
                            {isPushing ? "Pushing..." : "Push to Sheet"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
