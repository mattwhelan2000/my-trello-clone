"use client";

import React, { useState, useMemo } from "react";
import {
    X, CheckSquare, Square, FileText, Music, Film, Image as ImageIcon,
    File, Tag, Palette, ChevronDown, AlertTriangle, Check, Loader2, ListFilter, FileJson
} from "lucide-react";
import { detectFileType } from "@/lib/file-type-utils";

interface PreviewFile {
    name: string;
    url: string;
    cardName: string;
    scenePrefix: string | null;
    mimeType: string;
    matchedListTitle: string | null;
    matchedListId: string | null;
    isDuplicate: boolean;
    data?: any;
}

interface IngestPreviewDialogProps {
    boardId: string;
    files: PreviewFile[];
    resolvedFiles: any[]; // raw files to pass back
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (opts: {
        enabledFiles: string[]; // file names that are enabled
        globalColor: string | null;
        globalLabel: string | null;
        globalLabelColor: string | null;
        resolvedFiles: any[];
    }) => void;
    isConfirming: boolean;
    title?: string;
}

const CARD_COLORS = [
    { label: "None", value: "" },
    { label: "Purple", value: "#c084fc" },
    { label: "Blue", value: "#60a5fa" },
    { label: "Green", value: "#4ade80" },
    { label: "Yellow", value: "#fbbf24" },
    { label: "Red", value: "#f87171" },
    { label: "Orange", value: "#fb923c" },
    { label: "Pink", value: "#f472b6" },
    { label: "Slate", value: "#1e293b" },
    { label: "Teal", value: "#22d3ee" },
];

function FileIcon({ mimeType, className = "h-4 w-4" }: { mimeType: string; className?: string }) {
    if (mimeType.startsWith("image/")) return <ImageIcon className={className} />;
    if (mimeType.startsWith("audio/")) return <Music className={className} />;
    if (mimeType.startsWith("video/")) return <Film className={className} />;
    if (mimeType === "application/pdf") return <FileText className={`${className} text-red-500`} />;
    if (mimeType === "application/json") return <FileJson className={`${className} text-blue-500`} />;
    return <File className={className} />;
}

export function IngestPreviewDialog({
    boardId,
    files,
    resolvedFiles,
    isOpen,
    onClose,
    onConfirm,
    isConfirming,
    title = "Bulk Ingest Preview",
}: IngestPreviewDialogProps) {
    const [enabledFiles, setEnabledFiles] = useState<Set<string>>(() => new Set(files.map(f => f.name)));
    const [globalColor, setGlobalColor] = useState("");
    const [globalLabel, setGlobalLabel] = useState("");
    const [globalLabelColor, setGlobalLabelColor] = useState("#c084fc");
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showLabelInput, setShowLabelInput] = useState(false);
    const [groupByList, setGroupByList] = useState(true);
    const [boardLabels, setBoardLabels] = useState<{ id: string; title: string; color: string }[]>([]);
    const [isFetchingLabels, setIsFetchingLabels] = useState(false);

    // Sync enabled files whenever the dialog opens or files change
    React.useEffect(() => {
        if (isOpen && files.length > 0) {
            setEnabledFiles(new Set(files.filter(f => f && f.name).map(f => f.name)));
        }
    }, [isOpen, files]);

    // Fetch existing board labels
    React.useEffect(() => {
        if (isOpen && showLabelInput && boardLabels.length === 0) {
            setIsFetchingLabels(true);
            fetch(`/api/boards/${boardId}/labels`)
                .then(res => res.ok ? res.json() : [])
                .then(data => {
                    setBoardLabels(data);
                    setIsFetchingLabels(false);
                })
                .catch(() => setIsFetchingLabels(false));
        }
    }, [isOpen, showLabelInput, boardId, boardLabels.length]);

    // Group files by their matched list
    const grouped = useMemo(() => {
        if (!groupByList) return { "All Files": files };
        const groups: Record<string, PreviewFile[]> = {};
        for (const f of files) {
            if (!f) continue;
            const key = f.matchedListTitle || "⚠️ No Matching List";
            if (!groups[key]) groups[key] = [];
            groups[key].push(f);
        }
        return groups;
    }, [files, groupByList]);

    const handleConfirm = () => {
        onConfirm({
            enabledFiles: [...enabledFiles],
            globalColor: globalColor || null,
            globalLabel: globalLabel || null,
            globalLabelColor: globalLabelColor || null,
            resolvedFiles,
        });
    };

    const toggleFile = (name: string) => {
        const next = new Set(enabledFiles);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setEnabledFiles(next);
    };

    const toggleAll = (on: boolean) => {
        setEnabledFiles(on ? new Set(files.map(f => f.name)) : new Set());
    };

    if (!isOpen) return null;

    const enabledCount = enabledFiles.size;
    const duplicateCount = files.filter(f => f && f.isDuplicate && enabledFiles.has(f.name)).length;


    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-white">{title}</h2>
                        <p className="text-xs text-orange-100 mt-0.5">{files.length} items found · {enabledCount} selected</p>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Global Options Bar */}
                <div className="bg-orange-50 border-b border-orange-100 px-6 py-3 flex flex-wrap items-center gap-3 flex-shrink-0">
                    {/* Toggle All */}
                    <div className="flex items-center gap-x-1.5">
                        <button
                            onClick={() => toggleAll(true)}
                            className="flex items-center gap-x-1 px-2.5 py-1 bg-white border border-neutral-200 rounded-md text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition shadow-sm"
                        >
                            <CheckSquare className="h-3.5 w-3.5 text-orange-600" /> All On
                        </button>
                        <button
                            onClick={() => toggleAll(false)}
                            className="flex items-center gap-x-1 px-2.5 py-1 bg-white border border-neutral-200 rounded-md text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition shadow-sm"
                        >
                            <Square className="h-3.5 w-3.5 text-neutral-400" /> All Off
                        </button>
                    </div>

                    <div className="w-px h-6 bg-orange-200" />

                    {/* Card Color */}
                    <div className="relative">
                        <button
                            onClick={() => { setShowColorPicker(!showColorPicker); setShowLabelInput(false); }}
                            className="flex items-center gap-x-2 px-2.5 py-1 bg-white border border-neutral-200 rounded-md text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition shadow-sm"
                        >
                            <div
                                className="h-3.5 w-3.5 rounded-sm border border-black/10"
                                style={{ backgroundColor: globalColor || "#e5e7eb" }}
                            />
                            <Palette className="h-3.5 w-3.5 text-neutral-500" />
                            Card Color
                            <ChevronDown className="h-3 w-3 text-neutral-400" />
                        </button>
                        {showColorPicker && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-xl p-3 z-10 w-48">
                                <p className="text-[10px] font-bold text-neutral-500 uppercase mb-2">Card Background</p>
                                <div className="grid grid-cols-5 gap-1.5">
                                    {CARD_COLORS.map(c => (
                                        <button
                                            key={c.value}
                                            onClick={() => { setGlobalColor(c.value); setShowColorPicker(false); }}
                                            title={c.label}
                                            className={`h-7 w-7 rounded-md border-2 transition ${globalColor === c.value ? "border-blue-500 scale-110" : "border-transparent hover:border-neutral-300"} ${!c.value ? "bg-neutral-100" : ""}`}
                                            style={{ backgroundColor: c.value || undefined }}
                                        >
                                            {!c.value && <span className="text-neutral-400 text-[9px]">–</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Label */}
                    <div className="relative">
                        <button
                            onClick={() => { setShowLabelInput(!showLabelInput); setShowColorPicker(false); }}
                            className="flex items-center gap-x-2 px-2.5 py-1 bg-white border border-neutral-200 rounded-md text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition shadow-sm"
                        >
                            {globalLabel ? (
                                <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold text-white" style={{ backgroundColor: globalLabelColor }}>
                                    {globalLabel}
                                </span>
                            ) : (
                                <Tag className="h-3.5 w-3.5 text-neutral-500" />
                            )}
                            Label
                            <ChevronDown className="h-3 w-3 text-neutral-400" />
                        </button>
                        {showLabelInput && (
                            <div className="absolute top-full left-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-xl p-3 z-10 w-64">
                                <p className="text-[10px] font-bold text-neutral-500 uppercase mb-2 text-center">Add Label to All Items</p>
                                
                                {boardLabels.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1.5 px-1">Select Existing</p>
                                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-neutral-50 rounded-md border border-neutral-100">
                                            {boardLabels.map(label => (
                                                <button
                                                    key={label.id}
                                                    onClick={() => { setGlobalLabel(label.title); setGlobalLabelColor(label.color); }}
                                                    className={`px-2 py-1 rounded-[4px] text-[10px] font-bold text-white transition-all ${globalLabel === label.title ? "ring-2 ring-blue-500 ring-offset-1 scale-105" : "hover:brightness-110"}`}
                                                    style={{ backgroundColor: label.color }}
                                                >
                                                    {label.title}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1.5 px-1">Create New or Search</p>
                                <input
                                    type="text"
                                    value={globalLabel}
                                    onChange={e => setGlobalLabel(e.target.value)}
                                    placeholder="Label name (e.g. GRAPHICS)"
                                    className="w-full text-xs px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-orange-500 mb-2 shadow-sm"
                                />
                                
                                <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1.5 px-1">Label Color</p>
                                <div className="grid grid-cols-5 gap-1.5 p-1 bg-neutral-50 rounded-md border border-neutral-100">
                                    {CARD_COLORS.slice(1).map(c => (
                                        <button
                                            key={c.value}
                                            onClick={() => setGlobalLabelColor(c.value)}
                                            title={c.label}
                                            className={`h-6 w-6 rounded-md border-2 transition ${globalLabelColor === c.value ? "border-blue-500 scale-110" : "border-transparent"}`}
                                            style={{ backgroundColor: c.value }}
                                        />
                                    ))}
                                </div>
                                
                                {globalLabel && (
                                    <button 
                                        onClick={() => setShowLabelInput(false)}
                                        className="w-full mt-3 py-1.5 bg-orange-600 text-white text-[10px] font-bold uppercase rounded-md hover:bg-orange-700 transition shadow-sm"
                                    >
                                        Apply to All
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="w-px h-6 bg-orange-200" />

                    {/* Group toggle */}
                    <button
                        onClick={() => setGroupByList(!groupByList)}
                        className={`flex items-center gap-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition shadow-sm border ${groupByList ? "bg-orange-600 text-white border-orange-600" : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"}`}
                    >
                        <ListFilter className="h-3.5 w-3.5" />
                        Group by List
                    </button>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {Object.entries(grouped).map(([listTitle, groupFiles]) => (
                        <div key={listTitle}>
                            {groupByList && (
                                <div className="flex items-center gap-x-2 mb-2">
                                    <div className="h-px flex-1 bg-neutral-200" />
                                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${listTitle.startsWith("⚠️") ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-700"}`}>
                                        {listTitle}
                                    </span>
                                    <div className="h-px flex-1 bg-neutral-200" />
                                </div>
                            )}
                            <div className="space-y-1.5">
                                {groupFiles.map(file => {
                                    const isEnabled = enabledFiles.has(file.name);
                                    return (
                                        <div
                                            key={file.name}
                                            onClick={() => toggleFile(file.name)}
                                            className={`flex items-center gap-x-3 p-3 rounded-lg border cursor-pointer transition select-none ${isEnabled ? "bg-white border-neutral-200 hover:border-orange-300" : "bg-neutral-50 border-neutral-100 opacity-50"}`}
                                        >
                                            {/* Checkbox */}
                                            <div className={`h-5 w-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition ${isEnabled ? "bg-orange-500 border-orange-500" : "bg-white border-neutral-300"}`}>
                                                {isEnabled && <Check className="h-3 w-3 text-white" />}
                                            </div>

                                            {/* File icon */}
                                            <div className={`h-9 w-9 rounded-md flex items-center justify-center flex-shrink-0 ${file.mimeType.startsWith("image/") ? "bg-blue-50" : file.mimeType === "application/pdf" ? "bg-red-50" : file.mimeType.startsWith("audio/") ? "bg-purple-50" : "bg-neutral-100"}`}>
                                                <FileIcon mimeType={file.mimeType} className="h-4 w-4" />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-neutral-800 truncate">{file.cardName || file.name}</p>
                                                <p className="text-[10px] text-neutral-500 truncate">{file.name}</p>
                                            </div>

                                            {/* Right side: list match + duplicate badge */}
                                            <div className="flex items-center gap-x-2 flex-shrink-0">
                                                {file.isDuplicate && (
                                                    <span className="text-[9px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full border border-yellow-200 flex items-center gap-x-0.5">
                                                        <AlertTriangle className="h-2.5 w-2.5" /> Duplicate
                                                    </span>
                                                )}
                                                {!groupByList && (
                                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${file.matchedListTitle ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-600"}`}>
                                                        {file.matchedListTitle || "No List Match"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="border-t bg-neutral-50 px-6 py-4 flex items-center justify-between gap-x-4 flex-shrink-0">
                    <div className="text-sm text-neutral-600">
                        <span className="font-bold text-neutral-900">{enabledCount}</span> of {files.length} files will be imported
                        {duplicateCount > 0 && (
                            <span className="text-yellow-600 ml-2">· {duplicateCount} duplicate{duplicateCount > 1 ? "s" : ""} will be skipped</span>
                        )}
                    </div>
                    <div className="flex items-center gap-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={enabledCount === 0 || isConfirming}
                            className="px-6 py-2 text-sm font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition shadow-md shadow-orange-200 flex items-center gap-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isConfirming ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Importing...</>
                            ) : (
                                <><Check className="h-4 w-4" /> Import {enabledCount} Card{enabledCount !== 1 ? "s" : ""}</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
