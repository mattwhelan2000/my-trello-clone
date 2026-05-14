"use client";

import React, { useState } from "react";
import { X, Calendar, Download, FileJson, Check, Copy } from "lucide-react";

interface CalendarExportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    boardTitle: string;
    days: any[]; // OneLineDay[]
}

export function CalendarExportDialog({ isOpen, onClose, boardTitle, days }: CalendarExportDialogProps) {
    const [title, setTitle] = useState(boardTitle);
    const [exportType, setExportType] = useState<"ical" | "google" | "both">("both");

    if (!isOpen) return null;

    const generateIcal = () => {
        let ics = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            `PRODID:-//Trello Clone//${title}//EN`,
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            `X-WR-CALNAME:${title}`
        ];

        days.forEach(day => {
            if (!day.date) return;
            
            const dateObj = new Date(day.date);
            if (isNaN(dateObj.getTime())) return;

            const yyyymmdd = dateObj.toISOString().split('T')[0].replace(/-/g, '');
            
            const scenesSummary = day.scenes.map((s: any) => s.sceneNum).filter((n: string) => n !== "?").join(", ");
            const summary = `DAY #${day.shootDay}${day.isSecondUnit ? " (2U)" : ""}: ${scenesSummary}`;
            
            const description = [
                day.shootTime ? `SCHEDULE: ${day.shootTime}` : "",
                "SCENES:",
                ...day.scenes.map((s: any) => ` - Sc${s.sceneNum} (${s.intExt}) ${s.location}: ${s.description}`)
            ].filter(Boolean).join("\\n");

            const location = day.scenes[0]?.location || "";

            ics.push("BEGIN:VEVENT");
            ics.push(`UID:${day.shootDay}-${day.isSecondUnit ? '2U' : 'main'}-${Date.now()}@trello.goodthinc.com`);
            ics.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
            ics.push(`DTSTART;VALUE=DATE:${yyyymmdd}`);
            ics.push(`DTEND;VALUE=DATE:${yyyymmdd}`); // All day events usually end on the same day or next day start
            ics.push(`SUMMARY:${summary}`);
            ics.push(`DESCRIPTION:${description}`);
            ics.push(`LOCATION:${location}`);
            ics.push("END:VEVENT");
        });

        ics.push("END:VCALENDAR");
        return ics.join("\r\n");
    };

    const generateGoogleCsv = () => {
        const headers = ["Subject", "Start Date", "Start Time", "End Date", "End Time", "All Day Event", "Description", "Location"];
        const rows = days.map(day => {
            if (!day.date) return null;
            const dateObj = new Date(day.date);
            if (isNaN(dateObj.getTime())) return null;

            const scenesSummary = day.scenes.map((s: any) => s.sceneNum).filter((n: string) => n !== "?").join(", ");
            const subject = `DAY #${day.shootDay}${day.isSecondUnit ? " (2U)" : ""}: ${scenesSummary}`;
            
            const startDate = dateObj.toLocaleDateString('en-US');
            
            // Try to extract times
            let startTime = "9:00 AM";
            let endTime = "7:00 PM";
            if (day.shootTime) {
                const callMatch = day.shootTime.match(/CREW CALL:\s*(\d+(?:\.\d+)?\s*(?:AM|PM))/i);
                if (callMatch) startTime = callMatch[1];
                const wrapMatch = day.shootTime.match(/WRAP:\s*(\d+(?:\.\d+)?\s*(?:AM|PM))/i);
                if (wrapMatch) endTime = wrapMatch[1];
            }

            const description = [
                day.shootTime ? `SCHEDULE: ${day.shootTime}` : "",
                "SCENES:",
                ...day.scenes.map((s: any) => `- Sc${s.sceneNum} (${s.intExt}) ${s.location}: ${s.description}`)
            ].filter(Boolean).join("\n");

            const location = day.scenes[0]?.location || "";

            return [
                subject,
                startDate,
                startTime,
                startDate,
                endTime,
                "False",
                description,
                location
            ];
        }).filter(Boolean);

        return [headers, ...rows!].map(r => r!.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    };

    const onExport = () => {
        if (exportType === "ical" || exportType === "both") {
            const data = generateIcal();
            const blob = new Blob([data], { type: "text/calendar" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${title.replace(/\s+/g, '_')}_schedule.ics`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        if (exportType === "google" || exportType === "both") {
            const data = generateGoogleCsv();
            const blob = new Blob([data], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${title.replace(/\s+/g, '_')}_google_cal.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-[#1e293b] text-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-white/10 flex flex-col scale-in-center">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 border-b border-white/10">
                    <div className="flex items-center gap-x-3">
                        <Calendar className="h-5 w-5 text-white" />
                        <h2 className="font-bold">Export to Calendar</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Calendar Title */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Calendar Name</label>
                        <input 
                            type="text" 
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition font-medium"
                            placeholder="Calendar Title"
                        />
                    </div>

                    {/* Format Selection */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Export Format</label>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { id: 'ical', label: 'Apple / Outlook / Generic (iCal)', icon: Calendar },
                                { id: 'google', label: 'Google Calendar (CSV Import)', icon: FileJson },
                                { id: 'both', label: 'Export Both', icon: Download }
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setExportType(opt.id as any)}
                                    className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${exportType === opt.id ? 'bg-blue-600/20 border-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'}`}
                                >
                                    <div className="flex items-center gap-x-3">
                                        <opt.icon className={`h-4 w-4 ${exportType === opt.id ? 'text-blue-400' : 'text-white/30'}`} />
                                        <span className="text-sm font-medium">{opt.label}</span>
                                    </div>
                                    {exportType === opt.id && <Check className="h-4 w-4 text-blue-400" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <p className="text-[11px] text-white/30 leading-relaxed italic">
                        {exportType === 'google' ? "Google Calendar CSVs can be imported via 'Settings' -> 'Import & Export' in Google Calendar." : "iCal (.ics) files can be opened by most calendar applications."}
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-white/5 border-t border-white/10 flex gap-x-3">
                    <button 
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 rounded-xl transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onExport}
                        className="flex-[1.5] bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-6 rounded-xl transition shadow-lg flex items-center justify-center gap-x-2"
                    >
                        <Download className="h-4 w-4" />
                        Download {exportType === 'both' ? 'Files' : 'File'}
                    </button>
                </div>
            </div>
        </div>
    );
}
