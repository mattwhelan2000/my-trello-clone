"use client";

import React from "react";
import { 
    X, Check, AlertTriangle, Loader2, List, FileText, 
    Clock, MapPin, Users, Zap, Layers 
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
    onConfirm: () => void;
    isConfirming: boolean;
    analysis: SyncChanges[];
}

export function SyncPreviewDialog({
    isOpen,
    onClose,
    onConfirm,
    isConfirming,
    analysis
}: SyncPreviewDialogProps) {
    if (!isOpen) return null;

    const totalVfx = analysis.reduce((acc, curr) => acc + curr.vfxCards.length, 0);
    const newLists = analysis.filter(a => a.listAction === "CREATE").length;

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
                                            {scene.standardCards.map((card, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs bg-neutral-50 p-2 rounded border border-neutral-100">
                                                    <div className="flex items-center gap-x-2 text-neutral-600">
                                                        {card.title === "Scene LOCATION" && <MapPin className="h-3 w-3 opacity-60" />}
                                                        {card.title === "TIME" && <Clock className="h-3 w-3 opacity-60" />}
                                                        {card.title === "SET LOCATION" && <MapPin className="h-3 w-3 opacity-60" />}
                                                        {card.title === "CHARACTERS" && <Users className="h-3 w-3 opacity-60" />}
                                                        <span>{card.title}</span>
                                                    </div>
                                                    <span className="font-medium text-neutral-900 truncate max-w-[150px]" title={card.detail}>
                                                        {card.detail || "–"}
                                                    </span>
                                                </div>
                                            ))}
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
                                                scene.vfxCards.map((vfx, i) => (
                                                    <div key={i} className="bg-yellow-50/30 border border-yellow-100 p-2 rounded flex flex-col gap-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-neutral-800 truncate">{vfx.title}</span>
                                                            {vfx.shotCount && (
                                                                <span className="text-[10px] font-bold bg-yellow-400/20 text-yellow-700 px-1.5 py-0.5 rounded border border-yellow-200">
                                                                    {vfx.shotCount} Shots
                                                                </span>
                                                            )}
                                                        </div>
                                                        {vfx.assets && (
                                                            <div className="text-[10px] text-neutral-500 flex items-center gap-x-1">
                                                                <span className="font-semibold uppercase text-[9px]">Assets:</span>
                                                                <span className="truncate">{vfx.assets}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
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
                        Review the changes above. Standard cards will be synced and unique VFX cards will be created for each row.
                    </div>
                    <div className="flex items-center gap-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
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
