"use client";

import React, { useState, useCallback } from "react";
import {
    X, Upload, FileText, Download, CalendarDays, Loader2,
    CheckSquare, Square, ChevronDown, ChevronRight, Film, Sun, Moon, AlertTriangle, Clock
} from "lucide-react";
import { CalendarExportDialog } from "./CalendarExportDialog";

export interface OneLineScene {
    sceneNum: string;
    intExt: string;
    location: string;
    timeOfDay: string;
    description: string;
}

export interface OneLineDay {
    shootDay: string;
    isSecondUnit: boolean;
    date: string;
    shootTime?: string;
    scenes: OneLineScene[];
}

interface OneLineScheduleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    boardId: string;
    boardTitle: string;
    boardLists: { id: string; title: string }[];
}

type Step = "upload" | "preview";

export function OneLineScheduleDialog({ isOpen, onClose, boardId, boardLists }: OneLineScheduleDialogProps) {
    const [step, setStep] = useState<Step>("upload");
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState<OneLineDay[]>([]);
    const [disabledDays, setDisabledDays] = useState<Set<string>>(new Set());
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [showCalendarExport, setShowCalendarExport] = useState(false);

    // ------- helpers -------
    const dayKey = (d: OneLineDay) => `${d.shootDay}-${d.isSecondUnit ? "2U" : "main"}`;

    const toggleDay = (key: string) => {
        setDisabledDays(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const toggleExpand = (key: string) => {
        setExpandedDays(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const enabledDays = days.filter(d => !disabledDays.has(dayKey(d)));

    // ------- file handling -------
    const processFile = async (file: File) => {
        setError(null);

        if (file.name.endsWith(".json")) {
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                const loaded: OneLineDay[] = Array.isArray(parsed) ? parsed : parsed.days;
                if (!loaded?.length) throw new Error("No days found in JSON.");
                setDays(loaded);
                setExpandedDays(new Set(loaded.slice(0, 3).map(dayKey)));
                setStep("preview");
            } catch (e: any) {
                setError("Could not parse JSON: " + e.message);
            }
            return;
        }

        if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
            setIsLoading(true);
            try {
                const fd = new FormData();
                fd.append("file", file);
                const res = await fetch("/api/parse-one-line", { method: "POST", body: fd });
                const data = await res.json();
                if (!res.ok || data.error) throw new Error(data.error || "Parse error");
                const loaded: OneLineDay[] = data.days;
                if (!loaded?.length) throw new Error("No shooting days found in the PDF. Please check the format or use the JSON import.");
                setDays(loaded);
                setExpandedDays(new Set(loaded.slice(0, 3).map(dayKey)));
                setStep("preview");
            } catch (e: any) {
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        setError("Please upload a .pdf or .json file.");
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

    // ------- CREATE CARDS -------
    const onCreateCards = async () => {
        setIsCreating(true);
        setError(null);
        try {
            const { createOneLineCards } = await import("@/actions/create-one-line-cards");
            const result = await createOneLineCards({ boardId, days: enabledDays, lists: boardLists });
            if (result?.serverError) throw new Error(result.serverError);
            if (result?.data?.created !== undefined) {
                setSuccessMsg(`✅ Created ${result.data.created} card(s) on the board.`);
            }
        } catch (e: any) {
            setError(e.message || "Failed to create cards.");
        } finally {
            setIsCreating(false);
        }
    };

    // ------- EXPORT JSON -------
    const onExportJson = () => {
        const json = JSON.stringify({ days: enabledDays }, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "one-line-schedule.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const onOpenCalendarExport = () => {
        setShowCalendarExport(true);
    };

    // ------- RENDER -------
    const todColor = (tod: string) => {
        const t = tod.toUpperCase();
        if (t.includes("NIGHT")) return { bg: "#1e3a5f", text: "#93c5fd" };
        if (t.includes("DUSK") || t.includes("DAWN")) return { bg: "#7c3aed", text: "#ddd6fe" };
        return { bg: "#854d0e", text: "#fef08a" };
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[300] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-[#0f172a] text-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-white/10">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#1e3a5f] to-[#1e293b] border-b border-white/10 flex-shrink-0">
                    <div className="flex items-center gap-x-3">
                        <div className="p-2 rounded-lg bg-yellow-400/20">
                            <Film className="h-5 w-5 text-yellow-300" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">One-Line Schedule Import</h2>
                            <p className="text-xs text-blue-300">
                                {step === "upload" ? "Upload a PDF or JSON one-line schedule" : `${days.length} shooting day(s) found`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* ---- STEP: UPLOAD ---- */}
                {step === "upload" && (
                    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-y-4">
                        <div
                            onDrop={onDrop}
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center transition cursor-pointer ${isDragging ? "border-yellow-400 bg-yellow-400/10" : "border-white/20 hover:border-yellow-400/60 hover:bg-white/5"}`}
                        >
                            <div className="p-4 rounded-full bg-yellow-400/10 mb-4">
                                <Upload className="h-8 w-8 text-yellow-400" />
                            </div>
                            <p className="text-white font-semibold text-lg mb-1">Drop your One-Line Schedule here</p>
                            <p className="text-white/50 text-sm mb-6">Supports PDF or JSON format</p>
                            <label className="cursor-pointer">
                                <span className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-yellow-950 font-bold text-sm rounded-lg transition shadow-lg">
                                    Browse Files
                                </span>
                                <input type="file" accept=".pdf,.json,application/pdf,application/json" className="sr-only" onChange={onFileChange} />
                            </label>
                        </div>

                        {isLoading && (
                            <div className="flex items-center gap-x-3 p-4 bg-blue-900/30 rounded-xl border border-blue-500/30">
                                <Loader2 className="h-5 w-5 text-blue-400 animate-spin flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold text-blue-300">Parsing PDF…</p>
                                    <p className="text-xs text-blue-400/70">Extracting shooting days, dates, and scenes</p>
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

                        <div className="text-xs text-white/30 text-center">
                            <p>PDF parsing works best with text-based PDFs. If results are poor, export as JSON first.</p>
                        </div>
                    </div>
                )}

                {/* ---- STEP: PREVIEW ---- */}
                {step === "preview" && (
                    <>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {/* Summary bar */}
                            <div className="flex items-center justify-between mb-2 px-1">
                                <span className="text-xs text-white/50">
                                    {enabledDays.length} of {days.length} days selected · {enabledDays.reduce((a, d) => a + d.scenes.length, 0)} scenes
                                </span>
                                <div className="flex items-center gap-x-2">
                                    <button
                                        onClick={() => setDisabledDays(new Set())}
                                        className="text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300 transition"
                                    >Select All</button>
                                    <span className="text-white/20">·</span>
                                    <button
                                        onClick={() => setDisabledDays(new Set(days.map(dayKey)))}
                                        className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition"
                                    >Select None</button>
                                </div>
                            </div>

                            {days.map(day => {
                                const key = dayKey(day);
                                const enabled = !disabledDays.has(key);
                                const expanded = expandedDays.has(key);
                                return (
                                    <div key={key} className={`rounded-xl border transition ${enabled ? "border-white/15 bg-white/5" : "border-white/5 bg-white/2 opacity-40"}`}>
                                        {/* Day row */}
                                        <div className="flex items-center gap-x-3 px-4 py-3">
                                            <button onClick={() => toggleDay(key)} className="flex-shrink-0">
                                                {enabled
                                                    ? <CheckSquare className="h-4 w-4 text-yellow-400" />
                                                    : <Square className="h-4 w-4 text-white/30" />}
                                            </button>

                                            <div className="flex items-center gap-x-2 flex-1 min-w-0">
                                                <span className="font-bold text-yellow-300 text-sm">
                                                    DAY {day.shootDay}{day.isSecondUnit ? " (2ND UNIT)" : ""}
                                                </span>
                                                {day.date && (
                                                    <span className="flex items-center gap-x-1 text-xs text-white/50">
                                                        <CalendarDays className="h-3 w-3" />{day.date}
                                                    </span>
                                                )}
                                                {day.shootTime && (
                                                    <span className="flex items-center gap-x-1 text-[10px] text-blue-300/60 bg-blue-500/10 px-2 py-0.5 rounded-full ml-2">
                                                        <Clock className="h-2.5 w-2.5" />{day.shootTime}
                                                    </span>
                                                )}
                                                <span className="ml-auto text-xs text-white/30">{day.scenes.length} scene{day.scenes.length !== 1 ? "s" : ""}</span>
                                            </div>

                                            <button onClick={() => toggleExpand(key)} className="p-1 text-white/40 hover:text-white transition">
                                                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                            </button>
                                        </div>

                                        {/* Scenes */}
                                        {expanded && (
                                            <div className="px-4 pb-3 space-y-2 border-t border-white/5 pt-3">
                                                {day.scenes.length === 0 ? (
                                                    <p className="text-xs text-white/30 italic">No scenes found for this day.</p>
                                                ) : day.scenes.map((scene, si) => {
                                                    const c = todColor(scene.timeOfDay);
                                                    const isNight = /NIGHT|DUSK|DAWN/.test(scene.timeOfDay.toUpperCase());
                                                    return (
                                                        <div key={si} className="flex items-start gap-x-3 p-3 rounded-lg bg-white/5 border border-white/8">
                                                            <div className="flex-shrink-0 mt-0.5">
                                                                {isNight ? <Moon className="h-3.5 w-3.5 text-blue-400" /> : <Sun className="h-3.5 w-3.5 text-yellow-400" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-x-2 flex-wrap gap-y-1">
                                                                    <span className="text-xs font-bold text-white/80">Sc{scene.sceneNum}</span>
                                                                    <span className="text-[10px] font-semibold text-white/40">{scene.intExt}</span>
                                                                    <span className="text-xs text-white/70 font-medium truncate">{scene.location}</span>
                                                                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: c.bg, color: c.text }}>{scene.timeOfDay}</span>
                                                                </div>
                                                                {scene.description && (
                                                                    <p className="text-[11px] text-white/40 mt-1 line-clamp-2">{scene.description}</p>
                                                                )}
                                                                {/* Fuzzy match preview */}
                                                                <FuzzyMatchPreview sceneNum={scene.sceneNum} lists={boardLists} />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {error && (
                                <div className="flex items-start gap-x-3 p-4 bg-red-900/30 rounded-xl border border-red-500/30">
                                    <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-red-300">{error}</p>
                                </div>
                            )}

                            {successMsg && (
                                <div className="p-4 bg-green-900/30 rounded-xl border border-green-500/30">
                                    <p className="text-sm text-green-300 font-semibold">{successMsg}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer actions */}
                        <div className="flex items-center justify-between gap-x-3 px-6 py-4 bg-white/5 border-t border-white/10 flex-shrink-0">
                            <button
                                onClick={() => { setStep("upload"); setDays([]); setError(null); setSuccessMsg(null); }}
                                className="px-4 py-2 text-sm text-white/60 hover:text-white transition"
                            >
                                ← Back
                            </button>
                            <div className="flex items-center gap-x-3">
                                <button
                                    onClick={onExportJson}
                                    disabled={enabledDays.length === 0}
                                    className="flex items-center gap-x-2 px-4 py-2 text-sm font-semibold rounded-lg bg-slate-700 hover:bg-slate-600 text-white transition disabled:opacity-40"
                                >
                                    <Download className="h-4 w-4" />
                                    Export JSON
                                </button>
                                <button
                                    onClick={onOpenCalendarExport}
                                    disabled={enabledDays.length === 0}
                                    className="flex items-center gap-x-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-40"
                                >
                                    <Calendar className="h-4 w-4" />
                                    Export Calendar
                                </button>
                                <button
                                    onClick={onCreateCards}
                                    disabled={isCreating || enabledDays.length === 0}
                                    className="flex items-center gap-x-2 px-5 py-2 text-sm font-bold rounded-lg bg-yellow-400 hover:bg-yellow-300 text-yellow-950 transition shadow-lg disabled:opacity-40"
                                >
                                    {isCreating ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</> : <><Film className="h-4 w-4" /> Create One-Line Cards</>}
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <CalendarExportDialog 
                isOpen={showCalendarExport}
                onClose={() => setShowCalendarExport(false)}
                boardTitle={boardTitle}
                days={enabledDays}
            />
        </div>
    );
}

// Mini component: shows which board list this scene matches (fuzzy)
function FuzzyMatchPreview({ sceneNum, lists }: { sceneNum: string; lists: { id: string; title: string }[] }) {
    if (!sceneNum || sceneNum === "?") {
        return <p className="text-[10px] text-red-400/70 mt-0.5">⚠ No scene number — will be skipped</p>;
    }
    
    const num = sceneNum.replace(/\D/g, "").padStart(3, "0");
    const numInt = parseInt(sceneNum.replace(/\D/g, ""), 10);
    
    let confidence = 0;
    let match = lists.find(l => {
        const t = l.title.toUpperCase();
        // Exact match or ScXXX prefix
        if (t.includes(`SC${num}`) || t.startsWith(`${numInt} `) || t.startsWith(`SC${numInt} `)) {
            confidence = 100;
            return true;
        }
        return false;
    });

    if (!match) {
        match = lists.find(l => {
            const t = l.title.toUpperCase();
            const re = new RegExp(`\\b0*${numInt}\\b`);
            if (re.test(t)) {
                confidence = 75;
                return true;
            }
            return false;
        });
    }

    if (!match) return <p className="text-[10px] text-red-400/70 mt-0.5">⚠ No matching list found — will be skipped</p>;

    const color = confidence === 100 ? "text-green-400" : "text-yellow-400";
    const bgColor = confidence === 100 ? "bg-green-500/10" : "bg-yellow-500/10";

    return (
        <div className="flex items-center gap-x-2 mt-1">
            <div className={`flex items-center gap-x-1 px-1.5 py-0.5 rounded ${bgColor} border border-white/5`}>
                <span className={`text-[8px] font-bold uppercase tracking-tighter ${color}`}>{confidence}% Match</span>
                <span className="text-[10px] text-white/40">→</span>
                <span className="text-[10px] text-white/70 font-medium truncate max-w-[150px]">{match.title}</span>
            </div>
        </div>
    );
}
