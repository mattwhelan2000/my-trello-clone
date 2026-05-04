"use client";

import React, { useState } from "react";
import { Settings, Image as ImageIcon, Palette, X, Download, Info, LayoutList, CreditCard, AlertTriangle, CheckCircle2, Search, Filter, Tag, Trash, ChevronDown, Pencil, Check } from "lucide-react";
import { useBoardStore } from "@/hooks/use-board-store";
import { deleteLabelBatch } from "@/actions/delete-label-batch";
import { updateLabelBatch } from "@/actions/update-label-batch";
import { useRouter } from "next/navigation";
import { useAction as useSafeAction } from "next-safe-action/hooks";
import { updateBoard } from "@/actions/update-board";
import { exportBoard } from "@/actions/export-board";
import { syncGoogleSheet } from "@/actions/sync-google-sheet";
import { pushGoogleSheet } from "@/actions/push-google-sheet";
import { updateListColors } from "@/actions/update-list-colors";
import { bulkIngestImages } from "@/actions/bulk-ingest-images";
import { migrateDriveUrls } from "@/actions/migrate-drive-urls";
import { useToast } from "@/components/ui/Toast";
import { formatImageUrl } from "@/lib/format-image-url";

import { SnapshotSelector } from "./SnapshotSelector";
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
    const [ingestUrls, setIngestUrls] = useState("");
    const { addToast } = useToast();
    const router = useRouter();

    // Local state for swatches so they update immediately
    const [currentBgColors, setCurrentBgColors] = useState(colorSwatches?.length ? colorSwatches : COLORS);
    const [currentListColors, setCurrentListColors] = useState(listColorSwatches?.length ? listColorSwatches : LIST_COLORS);

    // Editing state
    const [editingSwatch, setEditingSwatch] = useState<{ type: 'bg' | 'list', index: number } | null>(null);
    const colorInputRef = React.useRef<HTMLInputElement>(null);

    // Ingest Conflict State
    const [conflicts, setConflicts] = useState<{ name: string; cardName: string; listTitle: string }[]>([]);
    const [resolvedFiles, setResolvedFiles] = useState<{ name: string; url: string }[]>([]);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [resolutions, setResolutions] = useState<Record<string, "ignore" | "replace">>({});
    const [defaultResolution, setDefaultResolution] = useState<"ignore" | "replace">("ignore");
    const [isDoingForAll, setIsDoingForAll] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    // Search and Filter State from Global Store
    const { 
        query, 
        setQuery, 
        searchCards, 
        setSearchCards, 
        searchLists, 
        setSearchLists,
        selectedLabels,
        setSelectedLabels,
        toggleLabelFilter,
        searchInvert, 
        setSearchInvert,
        isFilterEnabled,
        setIsFilterEnabled,
        uniqueLabels,
        visibleCardCount,
        visibleListCount,
        visibleListIds
    } = useBoardStore();



    const isAnyFilterActive = query.trim() !== "" || (selectedLabels.size > 0 && isFilterEnabled);

    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isLabelFilterOpen, setIsLabelFilterOpen] = useState(false);
    const [labelToDelete, setLabelToDelete] = useState<string | null>(null);
    const [editingLabel, setEditingLabel] = useState<{ oldTitle: string; title: string; color: string } | null>(null);
    const labelColorInputRef = React.useRef<HTMLInputElement>(null);
    const labelColorTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const { execute, isExecuting: isUpdatingBoard } = useSafeAction(updateBoard, {
        onSuccess: () => {},
        onError: (error) => console.error(error)
    });

    const { execute: executeExport, isExecuting: isExporting } = useSafeAction(exportBoard, {
        onSuccess: ({ data }) => {
            if (data?.title) {
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
            if (data?.title) {
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

    const handleLabelColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!editingLabel) return;
        const newColor = e.target.value;
        
        // Update local state immediately for UI feedback
        setEditingLabel({ ...editingLabel, color: newColor });

        // Debounce the server update
        if (labelColorTimeoutRef.current) clearTimeout(labelColorTimeoutRef.current);
        
        labelColorTimeoutRef.current = setTimeout(() => {
            executeUpdateLabel({ 
                boardId, 
                oldTitle: editingLabel.oldTitle, 
                newTitle: editingLabel.title, 
                newColor 
            });
        }, 500);
    };

    const onColorSelect = (color: string) => {
        execute({ id: boardId, bgColor: color, bgImage: "" });
    };

    const onImageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!imageUrl) return;
        const formattedUrl = formatImageUrl(imageUrl);
        execute({ id: boardId, bgImage: formattedUrl || undefined, bgColor: "" });
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
            if (data && "success" in (data as any)) {
                addToast("Google Sheet Synced successfully", "success");
                setIsOpen(false);
                router.refresh();
            } else if (data && "error" in (data as any)) {
                addToast((data as any).error as string, "error");
            }
        },
        onError: (error) => {
            console.error("Sync failed", error);
            addToast("A network error occurred during sync.", "error");
        }
    });

    const { execute: executePush, isExecuting: isPushing } = useSafeAction(pushGoogleSheet, {
        onSuccess: ({ data }) => {
            if (data && "success" in (data as any)) {
                addToast("Board pushed to Google Sheet successfully", "success");
                setIsOpen(false);
            } else if (data && "error" in (data as any)) {
                addToast((data as any).error as string, "error");
            }
        },
        onError: (error) => {
            console.error("Push failed", error);
            addToast("A network error occurred during push.", "error");
        }
    });

    const { execute: executeUpdateListsColors, isExecuting: isUpdatingListsColors } = useSafeAction(updateListColors, {
        onSuccess: ({ data }) => {
            const count = data?.count || 0;
            addToast(`${count} list colors updated`, "success");
            setIsOpen(false);
        },
        onError: (error) => {
            console.error(error);
            addToast("Failed to update list colors", "error");
        }
    });

    const { execute: executeIngest, isExecuting: isIngesting } = useSafeAction(bulkIngestImages, {
        onSuccess: ({ data }) => {
            console.log("[BulkIngest] Action raw response:", data);
            
            if (data && "error" in data && data.error) {
                addToast(data.error as string, "error");
                return;
            }

            // Handle Ingest Result (Success)
            if (data && "count" in data) {
                console.log(`[BulkIngest] Ingest complete. Count: ${data.count}`);
                addToast(`Successfully ingested ${data.count} images`, "success");
                setIngestUrls("");
                setIsOpen(false);
                setShowConflictModal(false);
                setConflicts([]);
                setResolvedFiles([]);
                setResolutions({});
                setIsDoingForAll(false);
                router.refresh();
                return;
            }

            // Handle Analysis Mode Result (Conflicts Found)
            if (data && "conflicts" in data) {
                const conflictList = data.conflicts as { name: string; cardName: string; listTitle: string }[];
                const files = (data.resolvedFiles || []) as { name: string; url: string }[];
                
                setResolvedFiles(files);
                console.log(`[BulkIngest] Found ${conflictList.length} conflicts and ${files.length} total files`);
                
                if (conflictList.length > 0) {
                    setConflicts(conflictList);
                    setShowConflictModal(true);
                    return;
                }
            }
        },
        onError: (error) => {
            console.error("[BulkIngest] Action Hook Error:", error);
            addToast("Bulk ingest failed", "error");
        }
    });

    const onIngestSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const urls = ingestUrls.split("\n").map(u => u.trim()).filter(Boolean);
        if (urls.length === 0) return;

        // Step 1: Run analysis
        executeIngest({
            boardId,
            urls,
            isAnalysis: true,
        });
    };

    const onConfirmIngest = () => {
        const urls = ingestUrls.split("\n").map(u => u.trim()).filter(Boolean);
        executeIngest({
            boardId,
            urls,
            isAnalysis: false,
            resolvedFiles, // Use the files we already found
            resolutions: isDoingForAll ? {} : resolutions,
            defaultResolution: isDoingForAll ? defaultResolution : undefined,
        });
    };

    const { execute: executeDeleteLabel, isExecuting: isDeletingLabel } = useSafeAction(deleteLabelBatch, {
        onSuccess: ({ data }) => {
            if (data && "success" in data) {
                addToast(`Successfully deleted label from board`, "success");
                setLabelToDelete(null);
                router.refresh();
            }
        },
        onError: (error) => {
            console.error(error);
            addToast("Failed to delete label", "error");
        }
    });

    const { execute: executeUpdateLabel, isExecuting: isUpdatingLabel } = useSafeAction(updateLabelBatch, {
        onSuccess: ({ data }) => {
            if (data && "success" in data) {
                router.refresh();
            }
        },
        onError: (error) => {
            console.error(error);
            addToast("Failed to update label", "error");
        }
    });

    const { execute: executeMigrate, isExecuting: isMigrating } = useSafeAction(migrateDriveUrls, {
        onSuccess: ({ data }) => {
            if (data && "count" in data) {
                addToast(`Successfully migrated ${data.count} images.`, "success");
            }
        },
        onError: (error) => {
            console.error(error);
            addToast("Failed to migrate images", "error");
        }
    });

    const onMigrate = () => {
        executeMigrate({ boardId });
    };

    const anyLoading = isUpdatingBoard || isExporting || isExportingCSV || isSyncing || isPushing || isUpdatingListsColors || isIngesting || isDeletingLabel || isMigrating;
    if (!isMounted) return null;

    return (
        <div className="absolute top-4 right-4 z-[50] flex items-center gap-x-2">
            {/* Search and Filter UI Relocated Here */}
            <div className="flex items-center gap-x-2 mr-2">
                <SnapshotSelector boardId={boardId} />
                {/* ShotGrid-style Label Filter Split Button */}
                <div className="relative flex items-center shadow-lg">
                    <button
                        onClick={() => {
                            if (selectedLabels.size === 0) setIsLabelFilterOpen(!isLabelFilterOpen);
                            else setIsFilterEnabled(!isFilterEnabled);
                        }}
                        className={`flex items-center gap-x-1.5 px-3 py-1.5 rounded-l-md border backdrop-blur-sm transition text-sm font-medium border-r-0 ${isFilterEnabled && selectedLabels.size > 0 ? 'bg-blue-600 border-blue-400 text-white' : 'bg-black/20 border-white/20 text-white hover:bg-black/30'}`}
                    >
                        <Filter className="h-3.5 w-3.5" />
                        {selectedLabels.size > 0 ? `Labels (${selectedLabels.size})` : "Filter"}
                    </button>
                    <button
                        onClick={() => {
                            setIsLabelFilterOpen(!isLabelFilterOpen);
                            setIsSearchOpen(false);
                        }}
                        className={`px-2 py-1.5 rounded-r-md border backdrop-blur-sm transition text-white border-l-white/10 ${isFilterEnabled && selectedLabels.size > 0 ? 'bg-blue-700 border-blue-400' : 'bg-black/20 border-white/20 hover:bg-black/30'}`}
                    >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isLabelFilterOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isLabelFilterOpen && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-2xl border border-neutral-200 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[100]">
                            <div className="px-3 py-2.5 bg-neutral-50 border-b flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider text-left">Board Filters</span>
                                    <span className="text-[9px] text-neutral-400 leading-tight text-left">Toggle visibility by label</span>
                                </div>
                                <div className="flex items-center gap-x-2">
                                    {selectedLabels.size > 0 && (
                                        <button onClick={() => setSelectedLabels(new Set())} className="text-[10px] text-blue-600 hover:underline font-semibold">Clear</button>
                                    )}
                                </div>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto py-1 text-left">
                                {uniqueLabels.length === 0 ? (
                                    <div className="px-4 py-5 text-[10px] text-neutral-400 text-center italic flex flex-col items-center gap-y-2">
                                        <Tag className="h-4 w-4 opacity-20" />
                                        No labels on this board
                                    </div>
                                ) : (
                                    uniqueLabels.map(label => (
                                        <div 
                                            key={`filter-${label.title}`}
                                            className="px-3 py-2 hover:bg-neutral-100 cursor-pointer border-b border-neutral-50 last:border-0 group"
                                        >
                                            {editingLabel?.oldTitle === label.title ? (
                                                <div className="flex flex-col gap-y-2 py-1" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center gap-x-2">
                                                        <div 
                                                            className="h-6 w-6 rounded-md border shadow-sm cursor-pointer hover:scale-105 transition"
                                                            style={{ backgroundColor: editingLabel.color }}
                                                            onClick={() => labelColorInputRef.current?.click()}
                                                            title="Change Color"
                                                        />
                                                        <input 
                                                            autoFocus
                                                            className="flex-1 text-xs px-2 py-1 border rounded-md outline-none focus:ring-1 focus:ring-blue-500 font-bold uppercase"
                                                            value={editingLabel.title}
                                                            onChange={(e) => setEditingLabel({ ...editingLabel, title: e.target.value.toUpperCase() })}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    executeUpdateLabel({ boardId, oldTitle: editingLabel.oldTitle, newTitle: editingLabel.title, newColor: editingLabel.color });
                                                                    setEditingLabel(null);
                                                                }
                                                                if (e.key === "Escape") setEditingLabel(null);
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-x-1 justify-end">
                                                        <button 
                                                            onClick={() => setEditingLabel(null)}
                                                            className="p-1.5 rounded-md hover:bg-neutral-200 text-neutral-500 transition"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                executeUpdateLabel({ boardId, oldTitle: editingLabel.oldTitle, newTitle: editingLabel.title, newColor: editingLabel.color });
                                                                setEditingLabel(null);
                                                            }}
                                                            disabled={isUpdatingLabel}
                                                            className="p-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white transition shadow-sm"
                                                        >
                                                            <Check className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <div 
                                                        onClick={() => toggleLabelFilter(label.title)}
                                                        className="flex items-center gap-x-3 flex-1"
                                                    >
                                                        <div className={`h-4 w-4 rounded-md border transition flex items-center justify-center ${selectedLabels.has(label.title) ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200' : 'bg-white border-neutral-300'}`}>
                                                            {selectedLabels.has(label.title) && <div className="h-1.5 w-1.5 bg-white rounded-full" />}
                                                        </div>
                                                        <div className="flex items-center gap-x-2">
                                                            <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: label.color }} />
                                                            <span className={`text-xs ${selectedLabels.has(label.title) ? 'font-bold text-blue-700' : 'text-neutral-700'}`}>{label.title}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-x-1 opacity-0 group-hover:opacity-100 transition">
                                                        <button 
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                setEditingLabel({ oldTitle: label.title, title: label.title, color: label.color });
                                                                setTimeout(() => labelColorInputRef.current?.click(), 50);
                                                            }}
                                                            className="p-1 rounded-md hover:bg-neutral-200 transition"
                                                            title="Change Color"
                                                        >
                                                            <div className="h-3.5 w-3.5 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: label.color }} />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setEditingLabel({ oldTitle: label.title, title: label.title, color: label.color }); }}
                                                            className="p-1.5 rounded-md hover:bg-blue-50 text-neutral-400 hover:text-blue-600 transition"
                                                            title="Edit Label Name"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setLabelToDelete(label.title); }}
                                                            className="p-1.5 rounded-md hover:bg-red-50 text-neutral-400 hover:text-red-600 transition"
                                                            title="Delete from Board"
                                                        >
                                                            <Trash className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                            {selectedLabels.size > 0 && (
                                <div className="p-2 bg-blue-50/50 border-t flex items-center justify-between">
                                    <span className="text-[10px] font-medium text-blue-600">{selectedLabels.size} active</span>
                                    <button 
                                        onClick={() => setIsFilterEnabled(!isFilterEnabled)}
                                        className={`text-[10px] font-bold px-2 py-0.5 rounded transition ${isFilterEnabled ? 'bg-blue-600 text-white shadow-sm' : 'bg-neutral-200 text-neutral-600'}`}
                                    >
                                        {isFilterEnabled ? 'Enabled' : 'Disabled'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Search Bar Relocated */}
                <div className="relative">
                    <button
                        onClick={() => {
                            setIsSearchOpen(!isSearchOpen);
                            setIsLabelFilterOpen(false);
                        }}
                        className={`flex items-center gap-x-1.5 px-3 py-1.5 rounded-md border backdrop-blur-sm transition shadow-lg text-sm font-medium ${query ? 'bg-blue-600 border-blue-400 text-white' : 'bg-black/20 border-white/20 text-white hover:bg-black/30'}`}
                    >
                        <Search className="h-3.5 w-3.5" />
                        {query ? `"${query}"` : "Search"}
                    </button>

                    {isSearchOpen && (
                        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-neutral-200 p-3 animate-in fade-in slide-in-from-top-2 duration-200 z-[100] text-left">
                            <div className="flex flex-col gap-y-3">
                                <div className="flex flex-col gap-y-1">
                                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Search Cards</label>
                                    <div className="relative">
                                        <input
                                            autoFocus
                                            value={query}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder="Type to filter..."
                                            className="w-full text-xs px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-600 pr-8 text-neutral-900 bg-white"
                                        />
                                        {query && (
                                            <button 
                                                onClick={() => setQuery("")}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-x-4">
                                    <label className="flex items-center gap-x-2 cursor-pointer group text-neutral-800">
                                        <input
                                            type="checkbox"
                                            checked={searchCards}
                                            onChange={(e) => setSearchCards(e.target.checked)}
                                            className="h-3.5 w-3.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-600"
                                        />
                                        <span className="text-[10px] font-bold text-neutral-600 group-hover:text-neutral-900 transition uppercase tracking-tighter">Cards</span>
                                    </label>
                                    <label className="flex items-center gap-x-2 cursor-pointer group text-neutral-800">
                                        <input
                                            type="checkbox"
                                            checked={searchLists}
                                            onChange={(e) => setSearchLists(e.target.checked)}
                                            className="h-3.5 w-3.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-600"
                                        />
                                        <span className="text-[10px] font-bold text-neutral-600 group-hover:text-neutral-900 transition uppercase tracking-tighter">Lists</span>
                                    </label>
                                    <label className="flex items-center gap-x-2 cursor-pointer group text-neutral-800">
                                        <input
                                            type="checkbox"
                                            checked={searchInvert}
                                            onChange={(e) => setSearchInvert(e.target.checked)}
                                            className="h-3.5 w-3.5 rounded border-neutral-300 text-red-600 focus:ring-red-600"
                                        />
                                        <span className="text-[10px] font-bold text-red-600 group-hover:text-red-700 transition uppercase tracking-tighter">Invert</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Label Delete Confirmation Modal */}
            {labelToDelete && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 text-center">
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                                <AlertTriangle className="h-6 w-6 text-red-600" />
                            </div>
                            <h3 className="text-lg font-bold text-neutral-900">Delete Label?</h3>
                            <p className="mt-2 text-sm text-neutral-500">
                                This will remove the label <span className="font-bold text-neutral-700">"{labelToDelete}"</span> from all cards on this board. This cannot be undone.
                            </p>
                        </div>
                        <div className="bg-neutral-50 px-6 py-4 flex items-center gap-x-3">
                            <button
                                onClick={() => setLabelToDelete(null)}
                                className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-md transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => executeDeleteLabel({ boardId, labelTitle: labelToDelete })}
                                disabled={isDeletingLabel}
                                className="flex-1 px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-md transition shadow-md shadow-red-200"
                            >
                                {isDeletingLabel ? "Deleting..." : "Delete All"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="hidden md:flex flex-col items-end gap-y-1 mr-2">
                <div className="flex items-center gap-x-4 bg-black/40 text-white rounded-md px-4 py-1.5 text-sm font-medium backdrop-blur-md shadow-sm border border-white/20 font-mono">
                    <div className="flex items-center gap-x-1.5" title="Lists (Visible / Total)">
                        <LayoutList className="h-4 w-4 opacity-80" />
                        <span>{isAnyFilterActive ? `${visibleListCount} / ` : ""}{listsCount}</span>
                    </div>
                    <div className="w-[1px] h-4 bg-white/20" />
                    <div className="flex items-center gap-x-1.5" title="Cards (Visible / Total)">
                        <CreditCard className="h-4 w-4 opacity-80" />
                        <span>{isAnyFilterActive ? `${visibleCardCount} / ` : ""}{cardsCount}</span>
                    </div>
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
                                    onClick={() => executeUpdateListsColors({ boardId, color, listIds: visibleListIds })}
                                    onContextMenu={(e) => handleContextMenu(e, 'list', idx)}
                                    className="h-8 w-full rounded-sm hover:opacity-80 transition cursor-pointer border border-black/10 shadow-sm"
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

                    <div>
                        <h4 className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-x-1"><Download className="h-3 w-3" /> Bulk Ingest Images</h4>
                        <form onSubmit={onIngestSubmit} className="flex flex-col gap-y-2 mb-4">
                            <textarea
                                value={ingestUrls}
                                onChange={(e) => setIngestUrls(e.target.value)}
                                placeholder={"Paste a Google Drive folder URL...\nFiles named: Sc001_CARDNAME.jpg"}
                                className="text-sm px-2 py-1.5 border rounded-sm outline-none focus:ring-1 focus:ring-orange-600 w-full min-h-[60px]"
                                disabled={anyLoading}
                            />
                            <button type="submit" disabled={anyLoading || !ingestUrls.trim()} className="bg-orange-600 text-white w-full rounded-sm text-sm font-medium py-1.5 hover:bg-orange-700 transition">
                                {isIngesting ? "Ingesting..." : "Bulk Ingest"}
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

                        <button
                            onClick={() => executeMigrate({ boardId })}
                            disabled={anyLoading}
                            className="bg-amber-100 text-amber-800 w-full rounded-sm text-sm font-bold py-1.5 hover:bg-amber-200 transition flex items-center justify-center gap-x-2 border border-amber-200"
                        >
                            <AlertTriangle className="h-4 w-4" />
                            {isMigrating ? "Migrating..." : "Repair Broken Images"}
                        </button>
                    </div>
                </div>
            )}

            {/* Conflict Resolution Modal */}
            {showConflictModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex items-center gap-x-3 text-left">
                            <AlertTriangle className="h-6 w-6 text-orange-600" />
                            <div>
                                <h3 className="font-bold text-neutral-900">Duplicate Cards Found</h3>
                                <p className="text-xs text-neutral-600">{conflicts.length} items already exist on this board.</p>
                            </div>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto px-6 py-4 space-y-3">
                            {!isDoingForAll ? (
                                conflicts.map((conflict) => (
                                    <div key={conflict.name} className="flex items-center justify-between p-3 bg-neutral-50 rounded-md border border-neutral-200">
                                        <div className="flex flex-col gap-y-0.5 text-left">
                                            <span className="text-sm font-semibold text-neutral-800">{conflict.name}</span>
                                            <span className="text-xs text-neutral-500">List: {conflict.listTitle}</span>
                                        </div>
                                        <div className="flex items-center gap-x-2">
                                            <button
                                                onClick={() => setResolutions(prev => ({ ...prev, [conflict.name]: "ignore" }))}
                                                className={`px-3 py-1 text-xs rounded-full border transition ${resolutions[conflict.name] === "ignore" || !resolutions[conflict.name] ? "bg-neutral-800 text-white border-neutral-800" : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100"}`}
                                            >
                                                Ignore
                                            </button>
                                            <button
                                                onClick={() => setResolutions(prev => ({ ...prev, [conflict.name]: "replace" }))}
                                                className={`px-3 py-1 text-xs rounded-full border transition ${resolutions[conflict.name] === "replace" ? "bg-orange-600 text-white border-orange-600" : "bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100"}`}
                                            >
                                                Replace
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center flex flex-col items-center gap-y-4">
                                    <div className="flex items-center gap-x-4">
                                        <button
                                            onClick={() => setDefaultResolution("ignore")}
                                            className={`flex flex-col items-center gap-y-2 p-4 rounded-lg border-2 transition ${defaultResolution === "ignore" ? "border-neutral-800 bg-neutral-50" : "border-transparent bg-white hover:bg-neutral-50"}`}
                                        >
                                            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${defaultResolution === "ignore" ? "border-neutral-800 bg-neutral-800" : "border-neutral-300"}`}>
                                                {defaultResolution === "ignore" && <div className="h-2 w-2 bg-white rounded-full" />}
                                            </div>
                                            <span className="text-sm font-bold">Ignore All</span>
                                            <span className="text-xs text-neutral-500 text-center">Skip existing cards</span>
                                        </button>
                                        <button
                                            onClick={() => setDefaultResolution("replace")}
                                            className={`flex flex-col items-center gap-y-2 p-4 rounded-lg border-2 transition ${defaultResolution === "replace" ? "border-orange-600 bg-orange-50" : "border-transparent bg-white hover:bg-neutral-50"}`}
                                        >
                                            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${defaultResolution === "replace" ? "border-orange-600 bg-orange-600" : "border-neutral-300"}`}>
                                                {defaultResolution === "replace" && <div className="h-2 w-2 bg-white rounded-full" />}
                                            </div>
                                            <span className="text-sm font-bold">Replace All</span>
                                            <span className="text-xs text-neutral-500 text-center">Overwrite images</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-neutral-50 border-t flex flex-col gap-y-4">
                            <label className="flex items-center gap-x-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={isDoingForAll}
                                    onChange={(e) => setIsDoingForAll(e.target.checked)}
                                    className="h-4 w-4 rounded border-neutral-300 text-orange-600 focus:ring-orange-600"
                                />
                                <span className="text-sm text-neutral-700 group-hover:text-neutral-900 transition font-medium">Do this for all duplicates</span>
                            </label>

                            <div className="flex items-center gap-x-3">
                                <button
                                    onClick={() => {
                                        setShowConflictModal(false);
                                        setConflicts([]);
                                    }}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-md transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onConfirmIngest}
                                    disabled={isIngesting}
                                    className="flex-1 px-4 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-md transition shadow-md shadow-orange-200 flex items-center justify-center gap-x-2"
                                >
                                    {isIngesting ? "Ingesting..." : <><CheckCircle2 className="h-4 w-4" /> Confirm & Ingest</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <input 
                type="color" 
                ref={colorInputRef} 
                onChange={handleColorChange} 
                className="sr-only" 
                tabIndex={-1} 
                value={editingSwatch ? (editingSwatch.type === 'bg' ? currentBgColors[editingSwatch.index] : currentListColors[editingSwatch.index]) : "#ffffff"} 
            />

            <input 
                type="color"
                ref={labelColorInputRef}
                onChange={handleLabelColorChange}
                className="sr-only"
                value={editingLabel?.color || "#3b82f6"}
            />
        </div>
    );
};
