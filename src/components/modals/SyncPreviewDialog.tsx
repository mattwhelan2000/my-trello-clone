"use client";

import React, { useState } from "react";
import { 
    X, Check, AlertTriangle, Loader2, List, FileText, 
    Clock, MapPin, Users, Zap, Layers,
    CheckSquare, Square, Tag, Palette, ChevronDown
} from "lucide-react";

interface SyncChanges {
    sceneNum: string;
    listAction: "CREATE" | "UPDATE" | "NONE";
    newTitle: string;
    standardCards: { title: string; action: string; detail: string }[];
    vfxCards: { title: string; shotCount: string; assets: string; action: string }[];
}

interface SyncPreviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (opts: { globalColor?: string; globalLabel?: string; globalLabelColor?: string; skipZeroVfx: boolean; disabledCards: string[] }) => void;
    isConfirming: boolean;
    analysis: SyncChanges[];
    boardLabels?: { title: string; color: string; id?: string }[];
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

export function SyncPreviewDialog({
    isOpen,
    onClose,
    onConfirm,
    isConfirming,
    analysis,
    boardLabels = []
}: SyncPreviewDialogProps) {
    const [globalColor, setGlobalColor] = useState<string>("");
    const [globalLabel, setGlobalLabel] = useState<string>("");
    const [globalLabelColor, setGlobalLabelColor] = useState<string>("#3b82f6");
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showLabelInput, setShowLabelInput] = useState(false);
    const [skipZeroVfx, setSkipZeroVfx] = useState(false);
    const [disabledCards, setDisabledCards] = useState<Set<string>>(new Set());

    if (!isOpen) return null;

    const totalVfx = analysis.reduce((acc, curr) => acc + curr.vfxCards.length, 0);
    const newLists = analysis.filter(a => a.listAction === "CREATE").length;

    const handleConfirm = () => {
        onConfirm({
            globalColor: globalColor || undefined,
            globalLabel: globalLabel || undefined,
            globalLabelColor: globalLabelColor || undefined,
            skipZeroVfx,
            disabledCards: Array.from(disabledCards)
        });
    };

    const toggleCard = (id: string) => {
        const next = new Set(disabledCards);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setDisabledCards(next);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-[#f4f5f7] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-[#0079bf] px-6 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-x-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Layers className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Spreadsheet Sync Preview</h2>
                            <p className="text-xs text-blue-100 mt-0.5">
                                {analysis.length} Scenes · {totalVfx} VFX Cards · {newLists} New Lists
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Global Options Bar */}
                <div className="bg-white border-b border-neutral-200 px-6 py-3 flex flex-wrap items-center gap-4 flex-shrink-0">
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
                                <p className="text-[10px] font-bold text-neutral-500 uppercase mb-2 text-center">Add Label to All Cards</p>
                                
                                {boardLabels.length > 0 && (
                                    <div className="mb-3">
                                        <p className="text-[10px] font-bold text-neutral-400 uppercase mb-1.5 px-1">Select Existing</p>
                                        <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-neutral-50 rounded-md border border-neutral-100">
                                            {boardLabels.map(label => (
                                                <button
                                                    key={label.title}
                                                    onClick={() => { setGlobalLabel(label.title); setGlobalLabelColor(label.color); setShowLabelInput(false); }}
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
                                    onChange={(e) => setGlobalLabel(e.target.value)}
                                    placeholder="e.g. Needs Review"
                                    className="w-full text-xs px-2 py-1.5 border rounded-md outline-none focus:ring-1 focus:ring-blue-600 mb-2"
                                />
                                <div className="flex items-center gap-x-2">
                                    <input 
                                        type="color" 
                                        value={globalLabelColor}
                                        onChange={(e) => setGlobalLabelColor(e.target.value)}
                                        className="h-6 w-8 rounded-sm cursor-pointer p-0 border-0"
                                    />
                                    <button 
                                        onClick={() => setShowLabelInput(false)}
                                        className="flex-1 bg-blue-600 text-white text-xs font-bold py-1.5 rounded-md hover:bg-blue-700 transition"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-px h-6 bg-neutral-200" />

                    {/* Skip Zero VFX Checkbox */}
                    <label className="flex items-center gap-x-2 cursor-pointer group text-neutral-700">
                        <input
                            type="checkbox"
                            checked={skipZeroVfx}
                            onChange={(e) => setSkipZeroVfx(e.target.checked)}
                            className="h-4 w-4 rounded border-neutral-300 text-[#0079bf] focus:ring-[#0079bf]"
                        />
                        <span className="text-xs font-bold group-hover:text-neutral-900 transition">Don't create cards with 0 VFX</span>
                    </label>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {analysis.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-neutral-500">
                            <AlertTriangle className="h-12 w-12 mb-4 opacity-20" />
                            <p className="text-lg font-medium">No changes detected</p>
                            <p className="text-sm">The board is already in sync with the spreadsheet.</p>
                        </div>
                    ) : (
                        analysis.map((scene) => (
                            <div key={scene.sceneNum} className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
                                <div className={`px-4 py-2 flex items-center justify-between border-b ${scene.listAction === "CREATE" ? "bg-green-50 border-green-100" : "bg-neutral-50"}`}>
                                    <div className="flex items-center gap-x-2">
                                        <List className={`h-4 w-4 ${scene.listAction === "CREATE" ? "text-green-600" : "text-neutral-500"}`} />
                                        <span className="font-bold text-sm text-neutral-800">{scene.newTitle}</span>
                                        {scene.listAction === "CREATE" && (
                                            <span className="text-[9px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">New Scene</span>
                                        )}
                                        {scene.listAction === "UPDATE" && (
                                            <span className="text-[9px] font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">Renaming</span>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Standard Metadata */}
                                    <div>
                                        <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-x-1.5">
                                            <FileText className="h-3 w-3" /> Standard Cards
                                        </h4>
                                        <div className="space-y-1.5">
                                            {scene.standardCards.map((card, i) => {
                                                const id = `${scene.sceneNum}|${card.title}`;
                                                const disabled = disabledCards.has(id);
                                                return (
                                                    <div key={i} className={`flex items-center justify-between text-xs p-2 rounded border transition ${disabled ? "bg-neutral-100 border-neutral-200 opacity-50" : "bg-neutral-50 border-neutral-100"}`}>
                                                        <div className="flex items-center gap-x-2 text-neutral-600">
                                                            <button onClick={() => toggleCard(id)} className="focus:outline-none">
                                                                {disabled ? <Square className="h-3 w-3 text-neutral-400" /> : <CheckSquare className="h-3 w-3 text-[#0079bf]" />}
                                                            </button>
                                                            {card.title === "Scene LOCATION" && <MapPin className="h-3 w-3 opacity-60" />}
                                                            {card.title === "TIME" && <Clock className="h-3 w-3 opacity-60" />}
                                                            {card.title === "SET LOCATION" && <MapPin className="h-3 w-3 opacity-60" />}
                                                            {card.title === "CHARACTERS" && <Users className="h-3 w-3 opacity-60" />}
                                                            <span className={disabled ? "line-through" : ""}>{card.title}</span>
                                                        </div>
                                                        <span className="font-medium text-neutral-900 truncate max-w-[150px]" title={card.detail}>
                                                            {card.detail || "–"}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* VFX Cards */}
                                    <div>
                                        <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 flex items-center gap-x-1.5">
                                            <Zap className="h-3 w-3 text-yellow-500" /> VFX Entries ({scene.vfxCards.length})
                                        </h4>
                                        <div className="space-y-1.5">
                                            {scene.vfxCards.length === 0 ? (
                                                <div className="text-xs text-neutral-400 italic py-2">No VFX for this scene</div>
                                            ) : (
                                                scene.vfxCards.map((vfx, i) => {
                                                    const id = `${scene.sceneNum}|${vfx.title}`;
                                                    const disabled = disabledCards.has(id);
                                                    const isZeroVfx = skipZeroVfx && (!vfx.shotCount || vfx.shotCount === "0");
                                                    
                                                    if (isZeroVfx) return null;

                                                    return (
                                                        <div key={i} className={`border p-2 rounded flex flex-col gap-y-1 transition ${disabled ? "bg-neutral-100 border-neutral-200 opacity-50 line-through" : "bg-yellow-50/30 border-yellow-100"}`}>
                                                            <div className="flex items-center gap-x-2">
                                                                <button onClick={() => toggleCard(id)} className="focus:outline-none">
                                                                    {disabled ? <Square className="h-3 w-3 text-neutral-400" /> : <CheckSquare className="h-3 w-3 text-yellow-600" />}
                                                                </button>
                                                                <div className="flex items-center justify-between flex-1 min-w-0">
                                                                    <span className="text-xs font-bold text-neutral-800 truncate pr-2">{vfx.title}</span>
                                                                    {vfx.shotCount && (
                                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${disabled ? "bg-neutral-200 text-neutral-500 border-neutral-300" : "bg-yellow-400/20 text-yellow-700 border-yellow-200"}`}>
                                                                            {vfx.shotCount} Shots
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {vfx.assets && (
                                                                <div className="text-[10px] text-neutral-500 flex items-center gap-x-1 ml-5">
                                                                    <span className="font-semibold uppercase text-[9px]">Assets:</span>
                                                                    <span className="truncate">{vfx.assets}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="border-t bg-white px-6 py-4 flex items-center justify-between gap-x-4 flex-shrink-0">
                    <div className="text-sm text-neutral-600">
                        Review the changes above. You can customize colors, labels, and exclude specific cards from importing.
                    </div>
                    <div className="flex items-center gap-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isConfirming || analysis.length === 0}
                            className="px-6 py-2 text-sm font-bold text-white bg-[#0079bf] hover:bg-[#026aa7] rounded-lg transition shadow-md flex items-center gap-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isConfirming ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Syncing...</>
                            ) : (
                                <><Check className="h-4 w-4" /> Commit Sync</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
