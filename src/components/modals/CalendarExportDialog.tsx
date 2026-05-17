"use client";

import React, { useState } from "react";
import { X, Calendar, Download, FileJson, Check, Copy } from "lucide-react";

interface CalendarExportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    boardTitle: string;
    days: any[]; // OneLineDay[]
}

const TIMEZONES = [
    { id: "Europe/Budapest", label: "Budapest (CET/CEST - UTC+2)", tzname: "CEST", standardTzname: "CET", offsetFrom: "+0100", offsetTo: "+0200" },
    { id: "Europe/London", label: "London (GMT/BST - UTC+1)", tzname: "BST", standardTzname: "GMT", offsetFrom: "+0000", offsetTo: "+0100" },
    { id: "America/New_York", label: "New York / Atlanta (EST/EDT - UTC-4)", tzname: "EDT", standardTzname: "EST", offsetFrom: "-0500", offsetTo: "-0400" },
    { id: "America/Chicago", label: "Chicago / New Orleans (CST/CDT - UTC-5)", tzname: "CDT", standardTzname: "CST", offsetFrom: "-0600", offsetTo: "-0500" },
    { id: "America/Los_Angeles", label: "Los Angeles (PST/PDT - UTC-7)", tzname: "PDT", standardTzname: "PST", offsetFrom: "-0800", offsetTo: "-0700" },
    { id: "Australia/Sydney", label: "Sydney (AEST/AEDT - UTC+11)", tzname: "AEDT", standardTzname: "AEST", offsetFrom: "+1000", offsetTo: "+1100" },
    { id: "UTC", label: "UTC / GMT (Zulu Time)", tzname: "UTC", standardTzname: "UTC", offsetFrom: "+0000", offsetTo: "+0000" }
];

export function CalendarExportDialog({ isOpen, onClose, boardTitle, days }: CalendarExportDialogProps) {
    const [title, setTitle] = useState(boardTitle);
    const [exportType, setExportType] = useState<"ical" | "google" | "both">("both");
    const [selectedTz, setSelectedTz] = useState("Europe/Budapest");

    if (!isOpen) return null;

    const parseTimeToStandard = (timeStr: string): { ical: string; google: string } | null => {
        if (!timeStr) return null;
        
        // Match formats like "6AM", "5.30 PM", "6:30 PM", "5:30PM", "12PM", "12 AM"
        const match = timeStr.trim().match(/(\d+)(?::|\.)?(\d+)?\s*(AM|PM)/i);
        if (!match) return null;
        
        let hours = parseInt(match[1], 10);
        const minutes = match[2] || "00";
        const ampm = match[3].toUpperCase();
        
        // Standardise hours for 24h
        let hours24 = hours;
        if (ampm === "PM" && hours < 12) hours24 += 12;
        if (ampm === "AM" && hours === 12) hours24 = 0;

        // Standardise hours for 12h (AM/PM)
        let hours12 = hours;
        if (hours === 0) hours12 = 12;
        
        const icalTime = `${hours24.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}:00`;
        const googleTime = `${hours12}:${minutes.padStart(2, '0')} ${ampm}`;
        
        return { ical: icalTime, google: googleTime };
    };

    const generateIcal = () => {
        const tz = TIMEZONES.find(t => t.id === selectedTz) || TIMEZONES[0];
        let ics = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            `PRODID:-//Trello Clone//${title}//EN`,
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            `X-WR-CALNAME:${title}`,
            "BEGIN:VTIMEZONE",
            `TZID:${tz.id}`,
            "BEGIN:DAYLIGHT",
            `TZOFFSETFROM:${tz.offsetFrom}`,
            `TZOFFSETTO:${tz.offsetTo}`,
            `TZNAME:${tz.tzname}`,
            "DTSTART:19700329T020000",
            "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
            "END:DAYLIGHT",
            "BEGIN:STANDARD",
            `TZOFFSETFROM:${tz.offsetTo}`,
            `TZOFFSETTO:${tz.offsetFrom}`,
            `TZNAME:${tz.standardTzname}`,
            "DTSTART:19701025T030000",
            "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
            "END:STANDARD",
            "END:VTIMEZONE"
        ];

        days.forEach(day => {
            if (!day.date) return;
            
            const dateObj = new Date(day.date);
            if (isNaN(dateObj.getTime())) return;

            // Extract local parts directly to be 100% immune to UTC date timezone shifting
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dayNum = String(dateObj.getDate()).padStart(2, '0');
            const yyyymmdd = `${year}${month}${dayNum}`;
            
            let startTime = "06:00:00";
            
            if (day.shootTime) {
                const callMatch = day.shootTime.match(/CREW\s*CALL:\s*(\d+(?::|\.)?\d*?\s*(?:AM|PM))/i);
                if (callMatch) {
                    const parsed = parseTimeToStandard(callMatch[1]);
                    if (parsed) startTime = parsed.ical;
                }
            }

            // End time defaults to 11.5 hours after start time (5:30 PM for 6:00 AM call)
            // But if CAMERA WRAP or WRAP is found, use that
            let endTime = "17:30:00";
            if (startTime === "07:00:00") endTime = "18:30:00"; // Default 11.5h shift for 7AM call

            if (day.shootTime) {
                const wrapMatch = day.shootTime.match(/(?:CAMERA\s*)?WRAP:\s*(\d+(?::|\.)?\d*?\s*(?:AM|PM))/i);
                if (wrapMatch) {
                    const parsed = parseTimeToStandard(wrapMatch[1]);
                    if (parsed) endTime = parsed.ical;
                }
            }

            const startStr = `${yyyymmdd}T${startTime.replace(/:/g, '')}`;
            const endStr = `${yyyymmdd}T${endTime.replace(/:/g, '')}`;

            const scenesSummary = day.scenes.map((s: any) => s.sceneNum).filter((n: string) => n !== "?").join(", ");
            const summary = `DAY #${day.shootDay}${day.isSecondUnit ? " (2U)" : ""}: ${scenesSummary}`;
            
            const description = [
                day.shootTime ? `SCHEDULE: ${day.shootTime}` : "",
                "SCENES:",
                ...day.scenes.map((s: any) => ` - Sc${s.sceneNum} (${s.intExt}) ${s.location}: ${s.description.replace(/\n/g, '\\n')}`)
            ].filter(Boolean).join("\\n");

            const location = day.scenes[0]?.location || "";

            ics.push("BEGIN:VEVENT");
            ics.push(`UID:${day.shootDay}-${day.isSecondUnit ? '2U' : 'main'}-${Date.now()}@trello.goodthinc.com`);
            ics.push(`DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`);
            ics.push(`DTSTART;TZID=${tz.id}:${startStr}`);
            ics.push(`DTEND;TZID=${tz.id}:${endStr}`);
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

            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dayNum = String(dateObj.getDate()).padStart(2, '0');
            
            const scenesSummary = day.scenes.map((s: any) => s.sceneNum).filter((n: string) => n !== "?").join(", ");
            const subject = `DAY #${day.shootDay}${day.isSecondUnit ? " (2U)" : ""}: ${scenesSummary}`;
            
            // Format strictly as MM/DD/YYYY using local parts to prevent UTC shifting
            const startDate = `${month}/${dayNum}/${year}`;
            
            let startTime = "6:00 AM";
            let endTime = "5:30 PM";

            if (day.shootTime) {
                const callMatch = day.shootTime.match(/CREW\s*CALL:\s*(\d+(?::|\.)?\d*?\s*(?:AM|PM))/i);
                if (callMatch) {
                    const parsed = parseTimeToStandard(callMatch[1]);
                    if (parsed) startTime = parsed.google;
                }
            }

            if (startTime === "7:00 AM") endTime = "6:30 PM"; // Default 11.5h shift for 7AM call

            if (day.shootTime) {
                const wrapMatch = day.shootTime.match(/(?:CAMERA\s*)?WRAP:\s*(\d+(?::|\.)?\d*?\s*(?:AM|PM))/i);
                if (wrapMatch) {
                    const parsed = parseTimeToStandard(wrapMatch[1]);
                    if (parsed) endTime = parsed.google;
                }
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
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition font-medium text-white"
                            placeholder="Calendar Title"
                        />
                    </div>

                    {/* Timezone Selector */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-white/50 uppercase tracking-wider">Shoot Timezone</label>
                        <select
                            value={selectedTz}
                            onChange={(e) => setSelectedTz(e.target.value)}
                            className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition font-medium text-white cursor-pointer"
                        >
                            {TIMEZONES.map((tz) => (
                                <option key={tz.id} value={tz.id} className="bg-slate-900 text-white">
                                    {tz.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Timezone Info */}
                    {(() => {
                        const tz = TIMEZONES.find(t => t.id === selectedTz) || TIMEZONES[0];
                        return (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-start gap-x-3 text-emerald-400">
                                <Calendar className="h-4 w-4 shrink-0 mt-0.5" />
                                <div className="text-xs">
                                    <span className="font-bold">{tz.id.split("/")[1] || tz.id} Timezone Active ({tz.tzname})</span>
                                    <p className="text-emerald-400/70 mt-1">Crew Calls and Camera Wraps are automatically matched and formatted for {tz.label.split(" (")[0]}.</p>
                                </div>
                            </div>
                        );
                    })()}

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
