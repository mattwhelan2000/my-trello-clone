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
import { revertSync } from "@/actions/revert-sync";
import { pushGoogleSheet } from "@/actions/push-google-sheet";
import { updateListColors } from "@/actions/update-list-colors";
import { bulkIngestImages } from "@/actions/bulk-ingest-images";
import { migrateDriveUrls } from "@/actions/migrate-drive-urls";
import { useToast } from "@/components/ui/Toast";
import { formatImageUrl } from "@/lib/format-image-url";

import { SnapshotSelector } from "./SnapshotSelector";
import { DownloadBoardPDF } from "./DownloadBoardPDF";
import { IngestPreviewDialog } from "@/components/modals/IngestPreviewDialog";
import { SyncPreviewDialog } from "@/components/modals/SyncPreviewDialog";

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
    const [sheetTabName, setSheetTabName] = useState("");
    const [ingestUrls, setIngestUrls] = useState("");
    const { addToast } = useToast();
    const router = useRouter();

    // Local state for swatches so they update immediately
    const [currentBgColors, setCurrentBgColors] = useState(colorSwatches?.length ? colorSwatches : COLORS);
    const [currentListColors, setCurrentListColors] = useState(listColorSwatches?.length ? listColorSwatches : LIST_COLORS);

    // Editing state
    const [editingSwatch, setEditingSwatch] = useState<{ type: 'bg' | 'list', index: number } | null>(null);
    const colorInputRef = React.useRef<HTMLInputElement>(null);

    // Ingest State
    const [resolvedFiles, setResolvedFiles] = useState<any[]>([]);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [resolutions, setResolutions] = useState<Record<string, "ignore" | "replace">>({});
    const [defaultResolution, setDefaultResolution] = useState<"ignore" | "replace">("ignore");
    const [isDoingForAll, setIsDoingForAll] = useState(false);
    // Preview Dialog State
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const [previewFiles, setPreviewFiles] = useState<any[]>([]);
    const [isFetchingFolder, setIsFetchingFolder] = useState(false);
    
    // Sync Sync State
    const [syncAnalysis, setSyncAnalysis] = useState<any[]>([]);
    const [showSyncPreview, setShowSyncPreview] = useState(false);

    const [isMounted, setIsMounted] = useState(false);
    
    React.useEffect(() => {
        setIsMounted(true);
    }, []);

    // Search and Filter State from Global Store
    const { 
        boardLists,
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
            if (data && "analysis" in (data as any)) {
                setSyncAnalysis((data as any).analysis);
                setShowSyncPreview(true);
                return;
            }

            if (data && "success" in (data as any)) {
                addToast("Google Sheet Synced successfully", "success");
                setIsOpen(false);
                setShowSyncPreview(false);
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
            if (data && "error" in data && data.error) {
                addToast(data.error as string, "error");
                return;
            }

            // Handle successful import
            if (data && "count" in data) {
                addToast(`Successfully ingested ${data.count} cards`, "success");
                setIngestUrls("");
                setIsOpen(false);
                setShowPreviewDialog(false);
                setPreviewFiles([]);
                setResolvedFiles([]);
                router.refresh();
                return;
            }

            // Handle Analysis Mode Result — show Preview Dialog
            if (data && "preview" in data) {
                const preview = (data.preview || []) as any[];
                const files = (data.resolvedFiles || []) as any[];
                setPreviewFiles(preview);
                setResolvedFiles(files);
                setIsFetchingFolder(false);
                setShowPreviewDialog(true);
                return;
            }
        },
        onError: (error) => {
            console.error("[BulkIngest] Action Hook Error:", error);
            addToast("Bulk ingest failed. Check the folder URL and try again.", "error");
            setIsFetchingFolder(false);
        }
    });

    const onIngestSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            const urlInput = ingestUrls.trim();
            if (!urlInput) return;

            setIsFetchingFolder(true);

            // Detect Dropbox shared folder URL
            const isDropbox = urlInput.includes("dropbox.com");
            if (isDropbox) {
                // Fetch file list from Dropbox via our API route
                const res = await fetch(`/api/list-dropbox-folder?url=${encodeURIComponent(urlInput)}`);
                if (!res.ok) {
                    const err = await res.json();
                    addToast(`Dropbox Error: ${err.error || res.status}`, "error");
                    setIsFetchingFolder(false);
                    return;
                }
                const { files } = await res.json();
                if (!files || files.length === 0) {
                    addToast("No files found in that Dropbox folder.", "error");
                    setIsFetchingFolder(false);
                    return;
                }
                // Run analysis pass with the resolved files from Dropbox
                executeIngest({
                    boardId,
                    urls: [urlInput],
                    isAnalysis: true,
                    resolvedFiles: files,
                });
                return;
            }

            // Google Drive folder — run analysis server-side
            const urls = urlInput.split("\n").map((u: string) => u.trim()).filter(Boolean);
            executeIngest({
                boardId,
                urls,
                isAnalysis: true,
            });
        } catch (err: any) {
            console.error("[BulkIngest] Submit Error:", err);
            addToast("A critical error occurred while scanning. Check console for details.", "error");
            setIsFetchingFolder(false);
        }
    };

    const onConfirmPreviewIngest = (opts: {
        enabledFiles: string[];
        globalColor: string | null;
        globalLabel: string | null;
        globalLabelColor: string | null;
        resolvedFiles: any[];
    }) => {
        // Build file overrides: disable files not in the enabledFiles list
        const fileOverrides: Record<string, any> = {};
        for (const file of resolvedFiles) {
            if (!opts.enabledFiles.includes(file.name)) {
                fileOverrides[file.name] = { enabled: false };
            }
        }
        executeIngest({
            boardId,
            urls: [ingestUrls.trim()],
            isAnalysis: false,
            resolvedFiles: opts.resolvedFiles,
            fileOverrides,
            globalColor: opts.globalColor || undefined,
            globalLabel: opts.globalLabel || undefined,
            globalLabelColor: opts.globalLabelColor || undefined,
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

    const { execute: executeRevert, isExecuting: isReverting } = useSafeAction(revertSync, {
        onSuccess: () => {
            addToast("Reverted to the last pre-sync board state", "success");
            setIsOpen(false);
        },
        onError: (error) => {
            console.error("Revert sync failed", error);
            addToast("Failed to revert sync: " + error.message, "error");
        }
    });

    const anyLoading = isUpdatingBoard || isExporting || isExportingCSV || isSyncing || isPushing || isIngesting || isFetchingFolder || isMigrating || isReverting || isDeletingLabel;
    if (!isMounted) return null;

    return (
        <div className="absolute top-4 right-4 z-[50] flex items-center gap-x-2">
            {/* Search and Filter UI Relocated Here */}
            <div className="flex items-center gap-x-2 mr-2">
                <SnapshotSelector boardId={boardId} />
                <DownloadBoardPDF boardId={boardId} boardTitle={boardLists[0]?.board?.title || "Board Export"} />
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
                        <h4 className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-x-1"><Download className="h-3 w-3" /> Bulk Ingest Files</h4>
                        <form onSubmit={onIngestSubmit} className="flex flex-col gap-y-2 mb-4">
                            <textarea
                                value={ingestUrls}
                                onChange={(e) => setIngestUrls(e.target.value)}
                                placeholder={"Paste a Google Drive or Dropbox folder URL...\nFiles named: Sc001_CARDNAME.ext"}
                                className="text-sm px-2 py-1.5 border rounded-sm outline-none focus:ring-1 focus:ring-orange-600 w-full min-h-[60px]"
                                disabled={anyLoading || isFetchingFolder}
                            />
                            <button type="submit" disabled={anyLoading || isFetchingFolder || !ingestUrls.trim()} className="bg-orange-600 text-white w-full rounded-sm text-sm font-medium py-1.5 hover:bg-orange-700 transition flex items-center justify-center gap-x-2">
                                {(isIngesting || isFetchingFolder) ? (
                                    <><span className="animate-pulse">●</span> Scanning Folder...</>
                                ) : (
                                    "Preview & Ingest"
                                )}
                            </button>
                        </form>
                    </div>

                    <div>
                        <h4 className="text-xs font-semibold text-neutral-600 mb-2 flex items-center gap-x-1"><LayoutList className="h-3 w-3" /> Google Sheet ID & Tab</h4>
                        <form onSubmit={onSheetSubmit} className="flex flex-col gap-y-2 mb-4">
                            <input
                                value={sheetId}
                                onChange={(e) => setSheetId(e.target.value)}
                                placeholder="Paste Sheet URL or ID..."
                                className="text-sm px-2 py-1.5 border rounded-sm outline-none focus:ring-1 focus:ring-green-600 w-full"
                                disabled={anyLoading}
                            />
                            <input
                                value={sheetTabName}
                                onChange={(e) => setSheetTabName(e.target.value)}
                                placeholder="Tab Name (Optional)"
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
                            onClick={() => executeSync({ boardId, analyze: true, tabName: sheetTabName || undefined })}
                            disabled={anyLoading || !sheetId}
                            className="bg-green-100 text-green-800 w-full rounded-sm text-sm font-medium py-1.5 hover:bg-green-200 transition flex items-center justify-center gap-x-2"
                        >
                            <LayoutList className="h-4 w-4" />
                            {isSyncing ? "Analyzing..." : "Sync from Sheet"}
                        </button>
                        <button
                            onClick={() => {
                                if (confirm("Are you sure you want to revert to the state just before your last sync? This will delete any cards you created since then.")) {
                                    executeRevert({ boardId });
                                }
                            }}
                            disabled={anyLoading}
                            className="bg-red-100 text-red-800 w-full rounded-sm text-sm font-medium py-1.5 hover:bg-red-200 transition flex items-center justify-center gap-x-2 border border-red-200"
                        >
                            <AlertTriangle className="h-4 w-4" />
                            {isReverting ? "Reverting..." : "Revert Last Sync"}
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

            {/* Bulk Ingest Preview Dialog */}
            <IngestPreviewDialog
                boardId={boardId}
                files={previewFiles}
                resolvedFiles={resolvedFiles}
                isOpen={showPreviewDialog}
                onClose={() => { setShowPreviewDialog(false); setPreviewFiles([]); setIsFetchingFolder(false); }}
                onConfirm={onConfirmPreviewIngest}
                isConfirming={isIngesting}
            />

            <SyncPreviewDialog
                isOpen={showSyncPreview}
                onClose={() => { setShowSyncPreview(false); setSyncAnalysis([]); }}
                analysis={syncAnalysis}
                isConfirming={isSyncing}
                boardLabels={uniqueLabels}
                onConfirm={(opts) => executeSync({ 
                    boardId, 
                    analyze: false, 
                    tabName: sheetTabName || undefined,
                    ...opts
                })}
            />
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
