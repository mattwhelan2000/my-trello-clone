import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided." }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfBuffer = new Uint8Array(arrayBuffer);
        const { text: pages } = await extractText(pdfBuffer, { mergePages: false });
        const text = pages.join("\n");

        const result = parseOneLineSchedule(text);

        return NextResponse.json({ days: result });
    } catch (e: any) {
        console.error("[PARSE-ONE-LINE] Error:", e);
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
    }
}

export interface OneLineScene {
    sceneNum: string;
    intExt: string;
    location: string;
    timeOfDay: string; // "DAY" | "NIGHT" | "DUSK" | "DAWN" | etc.
    description: string;
}

export interface OneLineDay {
    shootDay: string;       // e.g. "1", "2", "2U" (2nd unit)
    isSecondUnit: boolean;
    date: string;           // e.g. "Monday, June 9, 2026"
    scenes: OneLineScene[];
}

// -------------------------------------------------------------------
// Core parser — tries to handle several real-world one-line PDF layouts
// -------------------------------------------------------------------
function parseOneLineSchedule(text: string): OneLineDay[] {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const days: OneLineDay[] = [];
    let currentDay: OneLineDay | null = null;

    // Patterns
    // "DAY 1"  "SHOOTING DAY 1"  "DAY 1 (2ND UNIT)"  "UNIT DAY 5"
    const dayLineRe = /(?:SHOOT(?:ING)?\s+)?DAY\s+(\d+[A-Z]?)\s*(?:\(?(2ND\s*UNIT|SECOND\s*UNIT|2U)\)?)?/i;
    // "Monday, June 9, 2026"  "9 June 2026"  "June 9, 2026"  "09/06/2026"
    const dateRe = /\b(?:(?:MON|TUE|WED|THU|FRI|SAT|SUN)\w*,?\s+)?(?:JAN\w*|FEB\w*|MAR\w*|APR\w*|MAY|JUN\w*|JUL\w*|AUG\w*|SEP\w*|OCT\w*|NOV\w*|DEC\w*)\s+\d{1,2},?\s+\d{4}/i;
    const dateReAlt = /\b\d{1,2}\s+(?:JAN\w*|FEB\w*|MAR\w*|APR\w*|MAY|JUN\w*|JUL\w*|AUG\w*|SEP\w*|OCT\w*|NOV\w*|DEC\w*)\s+\d{4}/i;
    const dateReNumeric = /\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/;
    const sceneHeadingRe = /^(?:Sc(?:ene)?\s*\.?\s*)?([A-Z0-9]+(?:[-][A-Z0-9]+)?)\s+(INT\.|EXT\.|I\/E\.|INT\/EXT\.?)\s+(.+?)\s+-\s+(DAY|NIGHT|DUSK|DAWN|CONT(?:INUOUS)?|LATER|MAGIC HOUR|GOLDEN HOUR|TWILIGHT)/i;
    const sceneHeadingRe2 = /^(INT\.|EXT\.|I\/E\.|INT\/EXT\.?)\s+(.+?)\s+-\s+(DAY|NIGHT|DUSK|DAWN|CONT(?:INUOUS)?|LATER|MAGIC HOUR|GOLDEN HOUR|TWILIGHT)/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // --- Detect DAY header ---
        const dayMatch = line.match(dayLineRe);
        if (dayMatch) {
            // Try to grab date from same line or next 1-2 lines
            let dateStr = "";
            const dateFromSameLine = line.match(dateRe) || line.match(dateReAlt) || line.match(dateReNumeric);
            if (dateFromSameLine) {
                dateStr = dateFromSameLine[0];
            } else {
                // Peek at next lines
                for (let j = 1; j <= 3 && i + j < lines.length; j++) {
                    const nextLine = lines[i + j];
                    const m = nextLine.match(dateRe) || nextLine.match(dateReAlt) || nextLine.match(dateReNumeric);
                    if (m) { dateStr = m[0]; break; }
                    // Stop if we hit another day marker
                    if (nextLine.match(dayLineRe)) break;
                }
            }

            const is2U = !!(dayMatch[2]);
            currentDay = {
                shootDay: dayMatch[1].toUpperCase(),
                isSecondUnit: is2U,
                date: dateStr,
                scenes: []
            };
            days.push(currentDay);
            continue;
        }

        if (!currentDay) continue;

        // --- Detect scene heading (with leading scene number) ---
        const sm1 = line.match(sceneHeadingRe);
        if (sm1) {
            // sm1[1]=sceneNum, sm1[2]=INT/EXT, sm1[3]=location, sm1[4]=TOD
            const sceneNum = sm1[1];
            const intExt = sm1[2].replace(/\.$/, "").toUpperCase();
            const location = sm1[3].trim().toUpperCase();
            const timeOfDay = sm1[4].toUpperCase();
            // Description: grab next non-empty, non-heading line(s)
            const desc = gatherDescription(lines, i + 1);
            currentDay.scenes.push({ sceneNum, intExt, location, timeOfDay, description: desc });
            continue;
        }

        // --- Detect scene heading (without leading number) ---
        const sm2 = line.match(sceneHeadingRe2);
        if (sm2) {
            const intExt = sm2[1].replace(/\.$/, "").toUpperCase();
            const location = sm2[2].trim().toUpperCase();
            const timeOfDay = sm2[3].toUpperCase();
            const desc = gatherDescription(lines, i + 1);
            // Try to extract a scene number from the end of the previous line or same
            const prevLine = i > 0 ? lines[i - 1] : "";
            const sceneNumMatch = prevLine.match(/\b([A-Z]?\d+[A-Z]?)\s*$/i) || line.match(/\bSc(?:ene)?\s*\.?\s*([A-Z0-9]+)/i);
            const sceneNum = sceneNumMatch ? sceneNumMatch[1].toUpperCase() : "?";
            currentDay.scenes.push({ sceneNum, intExt, location, timeOfDay, description: desc });
        }
    }

    // Fallback: if we got 0 days, try a simpler approach looking for patterns like "Day 1 - June 9"
    if (days.length === 0) {
        return parseOneLineScheduleFallback(text);
    }

    return days;
}

function gatherDescription(lines: string[], startIdx: number): string {
    const sceneHeadingRe2 = /^(INT\.|EXT\.|I\/E\.)/i;
    const dayLineRe = /(?:SHOOT(?:ING)?\s+)?DAY\s+\d/i;
    const descLines: string[] = [];
    for (let j = startIdx; j < Math.min(startIdx + 4, lines.length); j++) {
        const l = lines[j].trim();
        if (!l) break;
        if (l.match(sceneHeadingRe2) || l.match(dayLineRe)) break;
        if (l.toUpperCase() === l && l.length > 4) break; // all-caps likely a header
        descLines.push(l);
    }
    return descLines.join(" ").trim();
}

// Fallback parser: look for any "DAY N" and collect scene-like lines beneath it
function parseOneLineScheduleFallback(text: string): OneLineDay[] {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const days: OneLineDay[] = [];
    let currentDay: OneLineDay | null = null;

    const dayRe = /(?:^|\s)DAY\s+(\d+[A-Z]?)/i;
    const monthNames = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
    const dateRe = new RegExp(`\\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\\w*,?\\s+(?:${monthNames})\\s+\\d{1,2},?\\s+\\d{4}`, "i");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const dm = line.match(dayRe);
        if (dm && line.length < 80) {
            const dateMatch = line.match(dateRe);
            let dateStr = dateMatch ? dateMatch[0] : "";
            if (!dateStr) {
                for (let j = 1; j <= 3 && i + j < lines.length; j++) {
                    const m = lines[i + j].match(dateRe);
                    if (m) { dateStr = m[0]; break; }
                }
            }
            currentDay = { shootDay: dm[1].toUpperCase(), isSecondUnit: /2ND|SECOND|2U/i.test(line), date: dateStr, scenes: [] };
            days.push(currentDay);
            continue;
        }
        if (!currentDay) continue;

        // Grab any line with INT/EXT
        const intExtMatch = line.match(/(INT\.|EXT\.|I\/E\.)\s+([^-]+)\s+-\s+(DAY|NIGHT|DUSK|DAWN|CONT)/i);
        if (intExtMatch) {
            currentDay.scenes.push({
                sceneNum: "?",
                intExt: intExtMatch[1].replace(".", ""),
                location: intExtMatch[2].trim().toUpperCase(),
                timeOfDay: intExtMatch[3].toUpperCase(),
                description: ""
            });
        }
    }
    return days;
}
