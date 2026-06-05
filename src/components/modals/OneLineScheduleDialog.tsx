"use client";

import React, { useState, useCallback } from "react";
import {
    X, Upload, FileText, Download, CalendarDays, Loader2,
    CheckSquare, Square, ChevronDown, ChevronRight, Film, Sun, Moon, AlertTriangle, Clock, Calendar
} from "lucide-react";
import { CalendarExportDialog } from "./CalendarExportDialog";
import { createOneLineCards, getExistingListDays, getBoardLists } from "@/actions/create-one-line-cards";

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
    isSplinterUnit?: boolean;
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

export function OneLineScheduleDialog({ isOpen, onClose, boardId, boardTitle, boardLists }: OneLineScheduleDialogProps) {
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
    const [manualAssignments, setManualAssignments] = useState<Record<string, string>>({});
    const [omittedScenes, setOmittedScenes] = useState<Set<string>>(new Set());
    const [deleteExistingDayCards, setDeleteExistingDayCards] = useState(false);
    const [splitListsForMultiDayScenes, setSplitListsForMultiDayScenes] = useState(false);
    const [cloneCardsInSplitLists, setCloneCardsInSplitLists] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [showConsole, setShowConsole] = useState(false);
    const [unscheduledAssignments, setUnscheduledAssignments] = useState<Record<string, { shootDay: string; isSecondUnit: boolean; isSplinterUnit?: boolean; timeOfDay: string }>>({});
    const [showUnscheduledSection, setShowUnscheduledSection] = useState(false);
    const [lists, setLists] = useState<{ id: string; title: string }[]>(boardLists);

    // Load fresh board lists from DB to prevent state sync issues
    React.useEffect(() => {
        if (isOpen) {
            getBoardLists(boardId)
                .then(fetched => {
                    if (fetched?.length) {
                        setLists(fetched);
                    }
                })
                .catch(err => console.error("Failed to fetch fresh board lists:", err));
        }
    }, [isOpen, boardId]);

    // ------- helpers -------
    const dayKey = (d: OneLineDay) => {
        let unit = "main";
        if (d.isSplinterUnit) unit = "splinter";
        else if (d.isSecondUnit) unit = "2U";
        return `${d.shootDay}-${unit}`;
    };

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

    // Collect all matched board list IDs from manualAssignments or automatic auto-assignment
    const matchedListIds = new Set<string>();
    days.forEach((day, di) => {
        day.scenes.forEach((scene, si) => {
            const listId = manualAssignments[`${di}-${si}`] || fuzzyMatchList(scene.sceneNum, lists);
            if (listId && listId !== "omit") {
                matchedListIds.add(listId);
            }
        });
    });

    // Find all board lists that represent scenes but are NOT matched/assigned to any scene in the schedule
    const unscheduledLists = lists.filter(list => {
        const sceneNum = extractSceneNumFromTitle(list.title);
        if (!sceneNum) return false;
        return !matchedListIds.has(list.id);
    });

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
                
                // Pre-populate manual assignments based on fuzzy matching on import
                const initialAssignments: Record<string, string> = {};
                loaded.forEach((day, di) => {
                    day.scenes.forEach((scene, si) => {
                        const matchedId = fuzzyMatchList(scene.sceneNum, lists);
                        if (matchedId) {
                            initialAssignments[`${di}-${si}`] = matchedId;
                        }
                    });
                });
                setManualAssignments(initialAssignments);

                // Fetch and auto-assign days to unmatched lists based on existing board cards
                try {
                    const existingAssignments = await getExistingListDays(boardId);
                    setUnscheduledAssignments(existingAssignments);
                } catch (err) {
                    console.error("Failed to load existing day cards:", err);
                }

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

                // Pre-populate manual assignments based on fuzzy matching on import
                const initialAssignments: Record<string, string> = {};
                loaded.forEach((day, di) => {
                    day.scenes.forEach((scene, si) => {
                        const matchedId = fuzzyMatchList(scene.sceneNum, lists);
                        if (matchedId) {
                            initialAssignments[`${di}-${si}`] = matchedId;
                        }
                    });
                });
                setManualAssignments(initialAssignments);

                // Fetch and auto-assign days to unmatched lists based on existing board cards
                try {
                    const existingAssignments = await getExistingListDays(boardId);
                    setUnscheduledAssignments(existingAssignments);
                } catch (err) {
                    console.error("Failed to load existing day cards:", err);
                }

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
        setLogs(["Initiating card creation..."]);
        try {
            const result = await createOneLineCards({ 
                boardId, 
                days: enabledDays.map((day) => {
                    const originalDayIndex = days.indexOf(day);
                    const dayScenes = day.scenes.map((scene, si) => ({
                        ...scene,
                        listId: manualAssignments[`${originalDayIndex}-${si}`],
                        isOmitted: omittedScenes.has(`${originalDayIndex}-${si}`)
                    }));

                    // Find manually assigned unscheduled board lists for this shoot day
                    const assignedUnscheduled = Object.entries(unscheduledAssignments)
                        .filter(([_, assign]) => {
                            let unit = "main";
                            if (assign.isSplinterUnit) unit = "splinter";
                            else if (assign.isSecondUnit) unit = "2U";
                            const dayKeyOfAssign = `${assign.shootDay}-${unit}`;
                            return dayKeyOfAssign === dayKey(day);
                        })
                        .map(([listId, assign]) => {
                            const list = lists.find(l => l.id === listId);
                            const sceneNum = extractSceneNumFromTitle(list?.title || "") || "?";
                            return {
                                sceneNum,
                                intExt: list?.title.toUpperCase().includes("INT") ? "INT" : list?.title.toUpperCase().includes("EXT") ? "EXT" : "I/E",
                                location: list?.title.replace(/^SC\d+\s*|^SCENE\s*\d+\s*|^\d+\s*/i, "") || "",
                                timeOfDay: assign.timeOfDay,
                                description: "Manually scheduled board scene.",
                                listId
                            };
                        });

                    return {
                        ...day,
                        scenes: [...dayScenes, ...assignedUnscheduled]
                    };
                }), 
                lists: lists,
                deleteExistingDayCards,
                splitListsForMultiDayScenes,
                cloneCardsInSplitLists
            });
            
            if (result?.data?.logs) {
                setLogs(result.data.logs);
            }

            if (result?.validationErrors) {
                setError(`Validation Error: ${JSON.stringify(result.validationErrors)}`);
                setShowConsole(true);
                return;
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
                setSuccessMsg(`✅ Created ${result.data.created} card(s) on the board.`);
            }
        } catch (e: any) {
            setError(e.message || "Failed to create cards.");
            setShowConsole(true);
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
                                <input id="oneline-file-input" name="oneline-file-input" type="file" accept=".pdf,.json,application/pdf,application/json" className="sr-only" onChange={onFileChange} />
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
                        {/* Year Mismatch Warning */}
                        {(() => {
                            const currentYear = new Date().getFullYear();
                            const mismatchedDays = days.filter(d => {
                                if (!d.date) return false;
                                // Handle ordinal suffixes first
                                let cleaned = d.date.replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+/i, "").trim();
                                cleaned = cleaned.replace(/(\d+)(st|nd|rd|th)/gi, "$1");
                                
                                // If year is missing in the string, new Date(cleaned) will use current year
                                // We want to see if the string *explicitly* has a different year
                                const yearMatch = d.date.match(/\b(20\d{2})\b/);
                                if (yearMatch && parseInt(yearMatch[1], 10) !== currentYear) return true;
                                return false;
                            });

                            if (mismatchedDays.length > 0) {
                                return (
                                    <div className="mx-6 mt-4 p-3 bg-orange-900/30 border border-orange-500/30 rounded-xl flex items-start gap-x-3">
                                        <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-xs font-bold text-orange-300">Year Mismatch Detected</p>
                                            <p className="text-[10px] text-orange-200/70">
                                                Some dates in the schedule (e.g. Day {mismatchedDays[0].shootDay}) appear to be for a year other than {currentYear}. 
                                                All cards will be created with the current year ({currentYear}) unless corrected.
                                            </p>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        {/* Global Options Checkboxes */}
                        <div className="px-6 py-3 bg-white/5 border-b border-white/10 flex flex-col gap-y-2">
                            <label className="flex items-center gap-x-3 cursor-pointer group">
                                <div className={`p-0.5 rounded border transition ${deleteExistingDayCards ? "bg-red-500/20 border-red-500/50" : "bg-white/5 border-white/10 group-hover:border-white/20"}`}>
                                    {deleteExistingDayCards ? <CheckSquare className="h-4 w-4 text-red-400" /> : <Square className="h-4 w-4 text-white/30" />}
                                </div>
                                <input 
                                    id="delete-day-cards-check"
                                    name="delete-day-cards-check"
                                    type="checkbox" 
                                    className="sr-only" 
                                    checked={deleteExistingDayCards}
                                    onChange={e => setDeleteExistingDayCards(e.target.checked)}
                                />
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-white/80">Delete existing "DAY" cards</span>
                                    <span className="text-[10px] text-white/40">Removes all cards with a "DAY" label from the board before importing.</span>
                                </div>
                            </label>

                            <label className="flex items-center gap-x-3 cursor-pointer group">
                                <div className={`p-0.5 rounded border transition ${splitListsForMultiDayScenes ? "bg-blue-500/20 border-blue-500/50" : "bg-white/5 border-white/10 group-hover:border-white/20"}`}>
                                    {splitListsForMultiDayScenes ? <CheckSquare className="h-4 w-4 text-blue-400" /> : <Square className="h-4 w-4 text-white/30" />}
                                </div>
                                <input 
                                    id="split-lists-check"
                                    name="split-lists-check"
                                    type="checkbox" 
                                    className="sr-only" 
                                    checked={splitListsForMultiDayScenes}
                                    onChange={e => setSplitListsForMultiDayScenes(e.target.checked)}
                                />
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-white/80">Create list copies for multi-day scenes</span>
                                    <span className="text-[10px] text-white/40">If a scene is shot over multiple days, copies of the list will be created (Pt.1/N, Pt.2/N, etc.)</span>
                                </div>
                            </label>

                            {splitListsForMultiDayScenes && (
                                <label className="flex items-center gap-x-3 cursor-pointer group ml-6">
                                    <div className={`p-0.5 rounded border transition ${cloneCardsInSplitLists ? "bg-green-500/20 border-green-500/50" : "bg-white/5 border-white/10 group-hover:border-white/20"}`}>
                                        {cloneCardsInSplitLists ? <CheckSquare className="h-4 w-4 text-green-400" /> : <Square className="h-4 w-4 text-white/30" />}
                                    </div>
                                    <input 
                                        id="clone-cards-check"
                                        name="clone-cards-check"
                                        type="checkbox" 
                                        className="sr-only" 
                                        checked={cloneCardsInSplitLists}
                                        onChange={e => setCloneCardsInSplitLists(e.target.checked)}
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-white/80">Clone all cards in list</span>
                                        <span className="text-[10px] text-white/40">When creating "Pt" lists, copy all existing cards from the original list into the new parts.</span>
                                    </div>
                                </label>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {/* Unscheduled Board Scenes Section */}
                            {unscheduledLists.length > 0 && (
                                <div className="border border-orange-500/20 bg-orange-500/5 rounded-xl p-3 mb-4">
                                    <button 
                                        type="button"
                                        onClick={() => setShowUnscheduledSection(!showUnscheduledSection)}
                                        className="w-full flex items-center justify-between text-left"
                                    >
                                        <div className="flex items-center gap-x-2 text-orange-400">
                                            <AlertTriangle className="h-4 w-4 shrink-0" />
                                            <div className="text-xs font-bold">
                                                {unscheduledLists.length} Board Scenes NOT matched to a day in the PDF
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-x-1.5 text-[10px] bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 font-semibold px-2 py-0.5 rounded transition">
                                            <span>{showUnscheduledSection ? "Collapse" : "Review & Assign Day"}</span>
                                            {showUnscheduledSection ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                        </div>
                                    </button>

                                    {showUnscheduledSection && (
                                        <div className="mt-3 space-y-2 border-t border-orange-500/10 pt-3 max-h-[250px] overflow-y-auto pr-1">
                                            <p className="text-[10px] text-white/50 leading-relaxed italic mb-2">
                                                These lists exist on your board but were not detected in the imported PDF. You can optionally force-schedule them below:
                                            </p>
                                            {unscheduledLists.map((list) => {
                                                const assignment = unscheduledAssignments[list.id] || { shootDay: "", isSecondUnit: false, isSplinterUnit: false, timeOfDay: "DAY" };
                                                const sceneNum = extractSceneNumFromTitle(list.title) || "?";
                                                
                                                return (
                                                    <div key={list.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-slate-900/60 border border-white/5 rounded-lg text-xs">
                                                        <div className="flex items-center gap-x-2 min-w-0">
                                                            <div className="bg-orange-500/10 text-orange-400 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                                                Sc{sceneNum}
                                                            </div>
                                                            <span className="font-semibold text-white/80 truncate max-w-[200px]" title={list.title}>
                                                                {list.title.replace(/^SC\d+\s*|^SCENE\s*\d+\s*|^\d+\s*/i, "") || "Untitled List"}
                                                            </span>
                                                        </div>

                                                        <div className="flex items-center gap-x-2 flex-wrap">
                                                            {/* Day Select */}
                                                            <select
                                                                className="bg-slate-800 border border-white/10 rounded px-2 py-1 text-[11px] text-white outline-none focus:border-orange-500/50 cursor-pointer"
                                                                value={(() => {
                                                                    if (!assignment.shootDay) return "";
                                                                    let unit = "main";
                                                                    if (assignment.isSplinterUnit) unit = "splinter";
                                                                    else if (assignment.isSecondUnit) unit = "2U";
                                                                    return `${assignment.shootDay}-${unit}`;
                                                                })()}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setUnscheduledAssignments(prev => {
                                                                        const next = { ...prev };
                                                                        if (!val) {
                                                                            delete next[list.id];
                                                                        } else {
                                                                            const isSplinter = val.endsWith("-splinter");
                                                                            const is2U = val.endsWith("-2U");
                                                                            const shootDay = val.replace(/-2U|-splinter|-main$/, "");
                                                                            next[list.id] = {
                                                                                shootDay,
                                                                                isSecondUnit: is2U,
                                                                                isSplinterUnit: isSplinter,
                                                                                timeOfDay: assignment.timeOfDay || "DAY"
                                                                            };
                                                                        }
                                                                        return next;
                                                                    });
                                                                }}
                                                            >
                                                                <option value="">-- Unassigned --</option>
                                                                {days.map(d => (
                                                                    <option key={dayKey(d)} value={dayKey(d)}>
                                                                        Day {d.shootDay} {d.isSplinterUnit ? "(SPL)" : d.isSecondUnit ? "(2U)" : ""}
                                                                    </option>
                                                                ))}
                                                            </select>

                                                            {/* Label Select */}
                                                            {assignment.shootDay && (
                                                                <select
                                                                    className="bg-slate-800 border border-white/10 rounded px-2 py-1 text-[11px] text-white outline-none focus:border-orange-500/50 cursor-pointer"
                                                                    value={assignment.timeOfDay}
                                                                    onChange={(e) => {
                                                                        setUnscheduledAssignments(prev => ({
                                                                            ...prev,
                                                                            [list.id]: {
                                                                                ...prev[list.id],
                                                                                timeOfDay: e.target.value
                                                                            }
                                                                        }));
                                                                    }}
                                                                >
                                                                    <option value="DAY">☀️ DAY</option>
                                                                    <option value="NIGHT">🌙 NIGHT</option>
                                                                    <option value="DUSK">🌆 DUSK</option>
                                                                    <option value="DAWN">🌅 DAWN</option>
                                                                </select>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

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

                            {days.map((day, di) => {
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
                                                    DAY {day.shootDay}{day.isSplinterUnit ? " (SPLINTER UNIT)" : day.isSecondUnit ? " (2ND UNIT)" : ""}
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
                                                            <div className="flex-shrink-0 mt-1">
                                                                <input 
                                                                    id={`omit-scene-${di}-${si}`}
                                                                    name={`omit-scene-${di}-${si}`}
                                                                    type="checkbox"
                                                                    checked={omittedScenes.has(`${di}-${si}`)}
                                                                    onChange={(e) => {
                                                                        setOmittedScenes(prev => {
                                                                            const next = new Set(prev);
                                                                            if (e.target.checked) next.add(`${di}-${si}`);
                                                                            else next.delete(`${di}-${si}`);
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    className="h-4 w-4 rounded border-white/20 bg-white/10 text-yellow-400 focus:ring-yellow-400"
                                                                    title="Omit this scene"
                                                                />
                                                            </div>
                                                            <div className="flex-shrink-0 mt-0.5 ml-1">
                                                                {isNight ? <Moon className="h-3.5 w-3.5 text-blue-400" /> : <Sun className="h-3.5 w-3.5 text-yellow-400" />}
                                                            </div>
                                                            <div className={`flex-1 min-w-0 ${omittedScenes.has(`${di}-${si}`) ? "opacity-40 grayscale" : ""}`}>
                                                                <div className="flex items-center gap-x-2 flex-wrap gap-y-1">
                                                                    <span className="text-xs font-bold text-white/80">Sc{scene.sceneNum}</span>
                                                                    <span className="text-[10px] font-semibold text-white/40">{scene.intExt}</span>
                                                                    <span className="text-xs text-white/70 font-medium truncate">{scene.location}</span>
                                                                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: c.bg, color: c.text }}>{scene.timeOfDay}</span>
                                                                </div>
                                                                {scene.description && (
                                                                    <p className="text-[11px] text-white/40 mt-1 line-clamp-2">{scene.description}</p>
                                                                )}
                                                                {/* Fuzzy match preview & manual override */}
                                                                <div className="mt-2 flex flex-col gap-y-2">
                                                                    <FuzzyMatchPreview sceneNum={scene.sceneNum} lists={lists} manualId={manualAssignments[`${di}-${si}`]} />
                                                                    <div className="flex items-center gap-x-2">
                                                                        <label className="text-[10px] text-white/50 whitespace-nowrap">Assign to:</label>
                                                                        <select 
                                                                            id={`assign-scene-${di}-${si}`}
                                                                            name={`assign-scene-${di}-${si}`}
                                                                            className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white outline-none focus:border-yellow-400/50 flex-1 max-w-[200px]"
                                                                            value={manualAssignments[`${di}-${si}`] || ""}
                                                                            onChange={(e) => {
                                                                                setManualAssignments(prev => ({
                                                                                    ...prev,
                                                                                    [`${di}-${si}`]: e.target.value
                                                                                }));
                                                                            }}
                                                                        >
                                                                            <option value="">(Auto-detect)</option>
                                                                            <option value="omit">-- Omit --</option>
                                                                            {lists.map(l => {
                                                                                const assign = unscheduledAssignments[l.id];
                                                                                const daySuffix = assign?.shootDay ? ` (Day ${assign.shootDay}${assign.isSplinterUnit ? "SPL" : assign.isSecondUnit ? "2U" : ""})` : "";
                                                                                return (
                                                                                    <option key={l.id} value={l.id}>
                                                                                        {l.title}{daySuffix}
                                                                                    </option>
                                                                                );
                                                                            })}
                                                                        </select>
                                                                    </div>
                                                                </div>
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
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold text-red-300">Import Error</p>
                                        <p className="text-xs text-red-400/80">{error}</p>
                                    </div>
                                </div>
                            )}

                            {successMsg && (
                                <div className="p-4 bg-green-900/30 rounded-xl border border-green-500/30">
                                    <p className="text-sm text-green-300 font-semibold">{successMsg}</p>
                                </div>
                            )}

                            {/* Error Console */}
                            {(logs.length > 0 || showConsole) && (
                                <div className="mt-4 border border-white/10 rounded-xl overflow-hidden bg-black/40">
                                    <button 
                                        onClick={() => setShowConsole(!showConsole)}
                                        className="w-full flex items-center justify-between px-4 py-2 bg-white/5 hover:bg-white/10 transition"
                                    >
                                        <div className="flex items-center gap-x-2">
                                            <FileText className="h-4 w-4 text-blue-400" />
                                            <span className="text-xs font-bold uppercase tracking-wider text-white/60">Import Console / Logs</span>
                                        </div>
                                        {showConsole ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
                                    </button>
                                    
                                    {showConsole && (
                                        <div className="p-4 max-h-[200px] overflow-y-auto font-mono text-[10px] space-y-1 bg-black/60">
                                            {logs.length === 0 && <p className="text-white/20 italic">No logs available.</p>}
                                            {logs.map((log, i) => (
                                                <div key={i} className={`flex gap-x-2 ${log.startsWith("⚠") ? "text-yellow-400" : log.startsWith("ERR") || log.startsWith("FAILED") ? "text-red-400" : "text-white/60"}`}>
                                                    <span className="text-white/20 select-none">[{i+1}]</span>
                                                    <span>{log}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
function FuzzyMatchPreview({ sceneNum, lists, manualId }: { sceneNum: string; lists: { id: string; title: string }[]; manualId?: string }) {
    if (manualId === "omit") {
        return <p className="text-[10px] text-orange-400 mt-0.5 italic">Skipped (Manual Omit)</p>;
    }
    
    if (manualId) {
        const manualMatch = lists.find(l => l.id === manualId);
        return (
            <div className="flex items-center gap-x-2 mt-1">
                <div className="flex items-center gap-x-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-400/20">
                    <span className="text-[8px] font-bold uppercase tracking-tighter text-blue-400">Manual</span>
                    <span className="text-[10px] text-white/40">→</span>
                    <span className="text-[10px] text-white/70 font-medium truncate max-w-[150px]">{manualMatch?.title || "Unknown List"}</span>
                </div>
            </div>
        );
    }

    if (!sceneNum || sceneNum === "?") {
        return <p className="text-[10px] text-red-400/70 mt-0.5">⚠ No scene number — will be skipped</p>;
    }
    
    const matchedId = fuzzyMatchList(sceneNum, lists);
    if (!matchedId) {
        return <p className="text-[10px] text-red-400/70 mt-0.5 font-bold">⚠ NO MATCHING LIST FOUND</p>;
    }

    const matchedList = lists.find(l => l.id === matchedId);
    if (!matchedList) {
        return <p className="text-[10px] text-red-400/70 mt-0.5 font-bold">⚠ NO MATCHING LIST FOUND</p>;
    }

    return (
        <div className="flex items-center gap-x-2 mt-1">
            <div className="flex items-center gap-x-1 px-1.5 py-0.5 rounded bg-green-500/10 border border-white/5">
                <span className="text-[8px] font-bold uppercase tracking-tighter text-green-400">Auto Match</span>
                <span className="text-[10px] text-white/40">→</span>
                <span className="text-[10px] text-white/70 font-medium truncate max-w-[150px]">{matchedList.title}</span>
            </div>
        </div>
    );
}

const MODIFIER_SUFFIXES = new Set(["PT", "VFX", "PTL", "END", "START", "ST", "PART", "CONT", "CONTD", "CONT'D", "CON'T"]);

export interface ParsedSceneToken {
    numInt: number;
    num: string; // padded to 3 digits, e.g. "012"
    suffix: string; // "A", "B", etc. (modifier suffixes stripped!)
}

export function parseSceneToken(token: string): ParsedSceneToken | null {
    if (!token || token === "?") return null;

    // Standardize to uppercase and trim
    let clean = token.toUpperCase().trim();

    // Remove common prefixes if present, e.g. "SCENE ", "SC.", "SC " or "SC"
    clean = clean.replace(/^(?:SCENE|SC\.|SC)\s*/i, "");

    // Extract leading digits
    const numMatch = clean.match(/^(\d+)/);
    if (!numMatch) return null;

    const numInt = parseInt(numMatch[1], 10);
    const numStr = numMatch[1];
    const numPadded = numStr.padStart(3, "0");

    // Get the remainder of the string after the digits
    let remainder = clean.substring(numStr.length).trim();

    // Strip common punctuation or dividers (like spaces, slashes, hyphens, dots, parenthesis) at the start of remainder
    remainder = remainder.replace(/^[\s\/\-\.\(\)]+/, "");

    // Extract the trailing letters/tokens
    const letterMatch = remainder.match(/^([A-Z0-9]+)/);
    let rawSuffix = letterMatch ? letterMatch[1] : "";

    // Strip modifier suffixes if rawSuffix starts with or is equal to one of them
    let suffix = "";
    if (rawSuffix) {
        // If rawSuffix is a known modifier, or starts with one followed by digits (e.g. "PT1")
        const isModifier = Array.from(MODIFIER_SUFFIXES).some(mod => {
            const re = new RegExp(`^${mod}\\d*$`, "i");
            return re.test(rawSuffix);
        });
        if (!isModifier && rawSuffix.length <= 2 && !/^\d+$/.test(rawSuffix)) {
            suffix = rawSuffix;
        }
    }

    return {
        numInt,
        num: numPadded,
        suffix
    };
}

export function extractSceneNumFromTitle(title: string): string | null {
    const parsed = parseSceneToken(title);
    if (!parsed) return null;
    return `${parsed.numInt}${parsed.suffix}`;
}

export function fuzzyMatchList(sceneNum: string, lists: { id: string; title: string }[]): string | null {
    // If sceneNum has slashes, hyphens, or other delimiters (e.g. "105/104PT" or "56 PT/57"), split them!
    const tokens = sceneNum.split(/[\/\-+&]/).map(t => t.trim()).filter(Boolean);
    
    for (const token of tokens) {
        const parsedScene = parseSceneToken(token);
        if (!parsedScene) continue;

        // Search for a list that parses to the same clean scene number and suffix!
        let match = lists.find(l => {
            const parsedList = parseSceneToken(l.title);
            if (!parsedList) return false;
            return parsedList.numInt === parsedScene.numInt && parsedList.suffix === parsedScene.suffix;
        });

        if (match) return match.id;

        // Word-boundary fallback if no exact structured match is found:
        match = lists.find(l => {
            const re = new RegExp(`\\b0*${parsedScene.numInt}${parsedScene.suffix}\\b`, "i");
            return re.test(l.title);
        });
        if (match) return match.id;
    }

    return null;
}
