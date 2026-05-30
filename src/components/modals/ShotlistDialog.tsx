"use client";

import React, { useState, useCallback } from "react";
import { X, Upload, Loader2, AlertTriangle, CheckSquare, Square, ChevronDown, ChevronRight, Film, Link as LinkIcon } from "lucide-react";
import { createShotlistCards } from "@/actions/create-shotlist-cards";
import { ShotlistScene } from "@/app/api/parse-shotlist/route";

interface ShotlistDialogProps {
    isOpen: boolean;
    onClose: () => void;
    boardId: string;
    boardTitle: string;
    boardLists: { id: string; title: string }[];
}

type Step = "upload" | "preview";

export function ShotlistDialog({ isOpen, onClose, boardId, boardTitle, boardLists }: ShotlistDialogProps) {
    const [step, setStep] = useState<Step>("upload");
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dropboxUrl, setDropboxUrl] = useState("");
    const [scenes, setScenes] = useState<ShotlistScene[]>([]);
    const [expandedScenes, setExpandedScenes] = useState<Set<string>>(new Set());
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [duplicateToAllParts, setDuplicateToAllParts] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [showConsole, setShowConsole] = useState(false);
    
    // Global Options
    const [globalColor, setGlobalColor] = useState("");
    const [globalLabel, setGlobalLabel] = useState("");
    const [globalLabelColor, setGlobalLabelColor] = useState("#c084fc");
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showLabelInput, setShowLabelInput] = useState(false);
    const [boardLabels, setBoardLabels] = useState<{ id: string; title: string; color: string }[]>([]);
    const [isFetchingLabels, setIsFetchingLabels] = useState(false);

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

    const toggleExpand = (sceneNum: string) => {
        setExpandedScenes(prev => {
            const next = new Set(prev);
            if (next.has(sceneNum)) next.delete(sceneNum); else next.add(sceneNum);
            return next;
        });
    };

    const processFile = async (file: File) => {
        setError(null);
        if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
            setError("Please upload a .pdf file.");
            return;
        }

        setIsLoading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/parse-shotlist", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || "Parse error");
            
            const loaded = data.scenes || [];
            if (!loaded.length) throw new Error("No scenes found in the Shotlist PDF.");
            setScenes(loaded);
            setExpandedScenes(new Set(loaded.slice(0, 3).map((s: any) => s.sceneNum)));
            setStep("preview");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const processUrl = async () => {
        if (!dropboxUrl.trim()) return;
        setError(null);
        setIsLoading(true);
        try {
            const res = await fetch("/api/parse-shotlist", { 
                method: "POST", 
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: dropboxUrl.trim() })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || "Parse error");
            
            const loaded = data.scenes || [];
            if (!loaded.length) throw new Error("No scenes found in the Shotlist PDF.");
            setScenes(loaded);
            setExpandedScenes(new Set(loaded.slice(0, 3).map((s: any) => s.sceneNum)));
            setStep("preview");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) processFile(file);
    }, []);

    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = () => setIsDragging(false);

    const onCreateCards = async () => {
        setIsCreating(true);
        setError(null);
        setLogs(["Initiating shotlist card creation..."]);
        try {
            const result = await createShotlistCards({ 
                boardId, 
                scenes,
                lists: boardLists,
                duplicateToAllParts,
                globalColor: globalColor || null,
                globalLabel: globalLabel || null,
                globalLabelColor: globalLabelColor || null,
            });
            
            if (result?.data?.logs) {
                setLogs(result.data.logs);
            }

            if (result?.data?.error) {
                setError(result.data.error);
                setShowConsole(true);
                return;
            }

            if (result?.serverError) {
                throw new Error(result.serverError);
            }

            if (result?.data?.created !== undefined) {
                setSuccessMsg(`✅ Created ${result.data.created} SHOTLIST card(s) on the board.`);
            }
        } catch (e: any) {
            setError(e.message || "Failed to create cards.");
            setShowConsole(true);
        } finally {
            setIsCreating(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[300] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-[#0f172a] text-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-white/10">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#8b5cf6] to-[#4c1d95] border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-x-3">
                        <div className="p-2 rounded-lg bg-white/20">
                            <Film className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Import Shotlist</h2>
                            <p className="text-xs text-purple-200">
                                {step === "upload" ? "Upload a Shotlist PDF or provide a Dropbox link" : `${scenes.length} scene(s) found`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* ---- STEP: UPLOAD ---- */}
                {step === "upload" && (
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-y-6">
                        {/* URL Input */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-y-3">
                            <label className="text-sm font-semibold text-white/80 flex items-center gap-x-2">
                                <LinkIcon className="h-4 w-4 text-purple-400" /> Paste a Dropbox PDF Link
                            </label>
                            <div className="flex items-center gap-x-2">
                                <input 
                                    type="text" 
                                    placeholder="https://www.dropbox.com/scl/fi/..."
                                    className="flex-1 bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
                                    value={dropboxUrl}
                                    onChange={e => setDropboxUrl(e.target.value)}
                                    disabled={isLoading}
                                />
                                <button 
                                    onClick={processUrl}
                                    disabled={isLoading || !dropboxUrl.trim()}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition"
                                >
                                    Fetch
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-center text-white/40 text-xs font-bold uppercase tracking-wider">
                            <span className="h-px bg-white/10 flex-1 mr-4" /> OR <span className="h-px bg-white/10 flex-1 ml-4" />
                        </div>

                        {/* File Drop */}
                        <div
                            onDrop={onDrop}
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center transition cursor-pointer ${isDragging ? "border-purple-400 bg-purple-400/10" : "border-white/20 hover:border-purple-400/60 hover:bg-white/5"}`}
                        >
                            <div className="p-4 rounded-full bg-purple-400/10 mb-4">
                                <Upload className="h-8 w-8 text-purple-400" />
                            </div>
                            <p className="text-white font-semibold text-lg mb-1">Drop your Shotlist PDF here</p>
                            <label className="cursor-pointer mt-4">
                                <span className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm rounded-lg transition shadow-lg">
                                    Browse Files
                                </span>
                                <input type="file" accept=".pdf,application/pdf" className="sr-only" onChange={onFileChange} />
                            </label>
                        </div>

                        {isLoading && (
                            <div className="flex items-center gap-x-3 p-4 bg-purple-900/30 rounded-xl border border-purple-500/30">
                                <Loader2 className="h-5 w-5 text-purple-400 animate-spin flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-purple-300">Parsing Shotlist…</p>
                                    <p className="text-xs text-purple-400/70">Extracting scenes, shots, and lens data</p>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-start gap-x-3 p-4 bg-red-900/30 rounded-xl border border-red-500/30">
                                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-red-300">Error</p>
                                    <p className="text-xs text-red-400/80">{error}</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ---- STEP: PREVIEW ---- */}
                {step === "preview" && (
                    <>
                        {/* Global Options */}
                        <div className="px-6 py-3 bg-white/5 border-b border-white/10 flex flex-wrap items-center gap-4">
                            <label className="flex items-center gap-x-3 cursor-pointer group">
                                <div className={`p-0.5 rounded border transition ${duplicateToAllParts ? "bg-purple-500/20 border-purple-500/50" : "bg-white/5 border-white/10 group-hover:border-white/20"}`}>
                                    {duplicateToAllParts ? <CheckSquare className="h-4 w-4 text-purple-400" /> : <Square className="h-4 w-4 text-white/30" />}
                                </div>
                                <input 
                                    type="checkbox" 
                                    className="sr-only" 
                                    checked={duplicateToAllParts}
                                    onChange={e => setDuplicateToAllParts(e.target.checked)}
                                />
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-white/80">Add to all parts</span>
                                    <span className="text-[10px] text-white/40">Duplicate to Sc150 Pt.1, Pt.2 etc.</span>
                                </div>
                            </label>

                            <div className="w-px h-6 bg-white/10" />

                            {/* Card Color */}
                            <div className="relative">
                                <button
                                    onClick={() => { setShowColorPicker(!showColorPicker); setShowLabelInput(false); }}
                                    className="flex items-center gap-x-2 px-2.5 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-md text-xs font-semibold text-white/80 transition"
                                >
                                    <div
                                        className="h-3.5 w-3.5 rounded-sm border border-white/20"
                                        style={{ backgroundColor: globalColor || "#f59e0b" }}
                                    />
                                    Card Color
                                    <ChevronDown className="h-3 w-3 text-white/40" />
                                </button>
                                {showColorPicker && (
                                    <div className="absolute top-full left-0 mt-1 bg-neutral-800 border border-white/10 rounded-lg shadow-xl p-3 z-10 w-48">
                                        <p className="text-[10px] font-bold text-white/50 uppercase mb-2">Card Background</p>
                                        <div className="grid grid-cols-5 gap-1.5">
                                            {[
                                                { label: "None/Default", value: "" },
                                                { label: "Amber", value: "#f59e0b" },
                                                { label: "Purple", value: "#c084fc" },
                                                { label: "Blue", value: "#60a5fa" },
                                                { label: "Green", value: "#4ade80" },
                                                { label: "Yellow", value: "#fbbf24" },
                                                { label: "Red", value: "#f87171" },
                                                { label: "Orange", value: "#fb923c" },
                                                { label: "Pink", value: "#f472b6" },
                                                { label: "Slate", value: "#1e293b" },
                                            ].map(c => (
                                                <button
                                                    key={c.value}
                                                    onClick={() => { setGlobalColor(c.value); setShowColorPicker(false); }}
                                                    title={c.label}
                                                    className={`h-7 w-7 rounded-md border-2 transition ${globalColor === c.value ? "border-purple-400 scale-110" : "border-transparent hover:border-white/30"} ${!c.value ? "bg-white/10" : ""}`}
                                                    style={{ backgroundColor: c.value || undefined }}
                                                >
                                                    {!c.value && <span className="text-white/40 text-[9px]">–</span>}
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
                                    className="flex items-center gap-x-2 px-2.5 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-md text-xs font-semibold text-white/80 transition"
                                >
                                    {globalLabel ? (
                                        <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold text-white" style={{ backgroundColor: globalLabelColor }}>
                                            {globalLabel}
                                        </span>
                                    ) : (
                                        <span className="h-3.5 w-3.5 rounded-sm border border-white/20 bg-white/5 flex items-center justify-center text-[8px] text-white/40">L</span>
                                    )}
                                    Label
                                    <ChevronDown className="h-3 w-3 text-white/40" />
                                </button>
                                {showLabelInput && (
                                    <div className="absolute top-full left-0 mt-1 bg-neutral-800 border border-white/10 rounded-lg shadow-xl p-3 z-10 w-64">
                                        <p className="text-[10px] font-bold text-white/50 uppercase mb-2 text-center">Add Label to All Cards</p>
                                        
                                        {boardLabels.length > 0 && (
                                            <div className="mb-3">
                                                <p className="text-[10px] font-bold text-white/40 uppercase mb-1.5 px-1">Select Existing</p>
                                                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 bg-black/20 rounded-md border border-white/5">
                                                    {boardLabels.map(label => (
                                                        <button
                                                            key={label.id}
                                                            onClick={() => { setGlobalLabel(label.title); setGlobalLabelColor(label.color); setShowLabelInput(false); }}
                                                            className={`px-2 py-1 rounded-[4px] text-[10px] font-bold text-white transition-all ${globalLabel === label.title ? "ring-2 ring-purple-500 ring-offset-1 ring-offset-neutral-800 scale-105" : "hover:brightness-110"}`}
                                                            style={{ backgroundColor: label.color }}
                                                        >
                                                            {label.title}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-[10px] font-bold text-white/40 uppercase mb-1.5 px-1">Create New or Search</p>
                                        <input
                                            type="text"
                                            value={globalLabel}
                                            onChange={e => setGlobalLabel(e.target.value)}
                                            placeholder="Label name (e.g. SHOTLIST)"
                                            className="w-full text-xs px-2 py-1.5 border border-white/20 bg-black/40 text-white rounded-md outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 mb-2"
                                        />
                                        
                                        <p className="text-[10px] font-bold text-white/40 uppercase mb-1.5 px-1">Label Color</p>
                                        <div className="grid grid-cols-5 gap-1.5 p-1 bg-black/20 rounded-md border border-white/5">
                                            {[
                                                { label: "Purple", value: "#c084fc" },
                                                { label: "Blue", value: "#60a5fa" },
                                                { label: "Green", value: "#4ade80" },
                                                { label: "Yellow", value: "#fbbf24" },
                                                { label: "Red", value: "#f87171" },
                                                { label: "Orange", value: "#fb923c" },
                                                { label: "Pink", value: "#f472b6" },
                                                { label: "Slate", value: "#1e293b" },
                                                { label: "Teal", value: "#22d3ee" }
                                            ].map(c => (
                                                <button
                                                    key={c.value}
                                                    onClick={() => setGlobalLabelColor(c.value)}
                                                    title={c.label}
                                                    className={`h-6 w-6 rounded-md border-2 transition ${globalLabelColor === c.value ? "border-white scale-110" : "border-transparent"}`}
                                                    style={{ backgroundColor: c.value }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        {/* Scenes List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {scenes.map((scene, si) => {
                                const key = scene.sceneNum || `unknown-${si}`;
                                const expanded = expandedScenes.has(key);
                                const totalShots = scene.parts.reduce((acc, p) => acc + p.shots.length, 0);

                                return (
                                    <div key={key} className="rounded-xl border border-white/15 bg-white/5 transition">
                                        {/* Scene row */}
                                        <div className="flex items-center gap-x-3 px-4 py-3 cursor-pointer" onClick={() => toggleExpand(key)}>
                                            <div className="flex items-center gap-x-2 flex-1 min-w-0">
                                                <span className="font-bold text-purple-300 text-sm">
                                                    SC {scene.sceneNum || "?"}
                                                </span>
                                                <span className="text-xs font-semibold text-white/60 truncate" title={scene.sceneHeading}>
                                                    {scene.sceneHeading.replace(/^SC\s+[\dA-Z&,\-]+\s*/i, "")}
                                                </span>
                                                <span className="ml-auto text-xs text-white/40 bg-black/40 px-2 py-0.5 rounded-full border border-white/10">
                                                    {totalShots} shot{totalShots !== 1 ? "s" : ""}
                                                </span>
                                            </div>
                                            <button className="p-1 text-white/40 hover:text-white transition">
                                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </button>
                                        </div>

                                        {/* Parts / Shots */}
                                        {expanded && (
                                            <div className="px-4 pb-3 space-y-3 border-t border-white/5 pt-3">
                                                {scene.notes && (
                                                    <div className="text-xs text-yellow-300/80 italic bg-yellow-400/5 p-2 rounded">
                                                        Notes: {scene.notes}
                                                    </div>
                                                )}

                                                {scene.parts.map((part, pi) => (
                                                    <div key={pi} className="space-y-1">
                                                        {part.partName !== "Default" && (
                                                            <div className="text-[11px] font-bold text-white/60 uppercase tracking-wider mb-2">
                                                                {part.partName}
                                                            </div>
                                                        )}
                                                        {part.shots.map((shot, shi) => (
                                                            <div key={shi} className="flex gap-x-2 text-xs">
                                                                <span className="text-white/40 font-mono w-6 text-right flex-shrink-0">
                                                                    {shot.shotNumber}.
                                                                </span>
                                                                <span className="text-white/80">
                                                                    {shot.description}
                                                                </span>
                                                                {shot.lensAndCamera && (
                                                                    <span className="text-purple-300 font-mono text-[10px] whitespace-nowrap bg-purple-500/20 px-1.5 rounded flex items-center">
                                                                        {shot.lensAndCamera}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer / Console */}
                        <div className="p-4 bg-black/40 border-t border-white/10 flex-shrink-0">
                            {showConsole && (
                                <div className="mb-4 bg-black/60 rounded-xl p-3 border border-white/10 max-h-32 overflow-y-auto text-xs font-mono text-white/70 space-y-1">
                                    {logs.map((log, i) => (
                                        <div key={i} className={log.includes("ERROR") || log.includes("FAILED") ? "text-red-400" : log.includes("WARNING") ? "text-yellow-400" : ""}>
                                            {log}
                                        </div>
                                    ))}
                                    {error && <div className="text-red-400 mt-2 font-bold">{error}</div>}
                                </div>
                            )}

                            {successMsg ? (
                                <div className="flex flex-col gap-y-3">
                                    <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-xl text-green-300 text-sm font-bold text-center">
                                        {successMsg}
                                    </div>
                                    <button 
                                        onClick={onClose}
                                        className="w-full py-2 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl transition"
                                    >
                                        Close
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-x-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowConsole(!showConsole)}
                                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/80 text-sm font-bold rounded-xl transition"
                                    >
                                        {showConsole ? "Hide Logs" : "Show Logs"}
                                    </button>
                                    <button
                                        onClick={onCreateCards}
                                        disabled={isCreating}
                                        className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl transition flex justify-center items-center gap-x-2 shadow-lg shadow-purple-900/50"
                                    >
                                        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
                                        {isCreating ? "Creating Cards..." : `Create ${scenes.length} Shotlist Card(s)`}
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
