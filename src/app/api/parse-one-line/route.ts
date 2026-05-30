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
    isSplinterUnit?: boolean;
    date: string;           // e.g. "Monday, June 9, 2026"
    shootTime?: string;     // e.g. "CREW CALL: 6AM - LUNCH:12.00PM - CAMERA WRAP: 5.30 PM"
    scenes: OneLineScene[];
}

// -------------------------------------------------------------------
// Core parser — updated to handle the specific format provided
// -------------------------------------------------------------------
function parseOneLineSchedule(text: string): OneLineDay[] {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const days: OneLineDay[] = [];
    
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        // 1. Detect Day Start: "DAY #1 - MON, JUNE 1ST"
        const dayStartMatch = line.match(/^DAY\s+#?(\d+[A-Z]?)/i);
        if (dayStartMatch) {
            const shootDay = dayStartMatch[1].toUpperCase();
            // 2nd Unit detection: Be strict to avoid matching date ordinals like "JUNE 2ND"
            // Look for "2nd Unit" or "2U" or "Second Unit" as distinct phrases
            const is2U = /\b(?:2nd\s+Unit|2U|Second\s+Unit)\b/i.test(line);
            const isSplinter = /\b(?:splinter|splinter\s+unit|spl)\b/i.test(line);
            
            // Extract date from start line if possible (e.g. "JUNE 1ST")
            // We'll refine this later with the "End of Day" date which is more complete.
            const dateInHeader = line.split("/")[0].split("-").slice(1).join("-").trim();

            let shootTimeLine = "";
            let dayTextContent: string[] = [line];
            let scenes: OneLineScene[] = [];
            
            i++;
            // Collect lines until "End of Day"
            while (i < lines.length && !/^End of Day/i.test(lines[i])) {
                const dayLine = lines[i];
                dayTextContent.push(dayLine);
                
                // Check for Crew Call / Wrap
                if (/CREW\s*CALL|CAMERA\s*WRAP/i.test(dayLine)) {
                    shootTimeLine = dayLine;
                }
                
                i++;
            }

            let footerLine = "";
            if (i < lines.length && /^End of Day/i.test(lines[i])) {
                footerLine = lines[i];
                dayTextContent.push(footerLine);
            }

            // Extract real date from footer: "End of Day# 1 -- Monday, June 1, 2026"
            let finalDate = dateInHeader;
            const realDateMatch = footerLine.match(/--\s*((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[A-Za-z,\s0-9]+)\s*--/i);
            if (realDateMatch) {
                finalDate = realDateMatch[1].trim();
            } else {
                // Fallback: try to find a full date in the footer if the regex failed
                const dateParts = footerLine.split("--");
                if (dateParts.length >= 2) {
                    const potentialDate = dateParts[1].trim();
                    if (potentialDate.length > 5) finalDate = potentialDate;
                }
            }

            // Now parse scenes from the collected dayTextContent
            scenes = extractScenesFromDayBlock(dayTextContent);

            days.push({
                shootDay,
                isSecondUnit: is2U,
                isSplinterUnit: isSplinter,
                date: finalDate,
                shootTime: shootTimeLine,
                scenes
            });
        }
        i++;
    }

    const mergeDuplicateDays = (dayList: OneLineDay[]): OneLineDay[] => {
        const merged: OneLineDay[] = [];
        for (const day of dayList) {
            const existing = merged.find(d => d.shootDay === day.shootDay && d.isSecondUnit === day.isSecondUnit && d.isSplinterUnit === day.isSplinterUnit);
            if (existing) {
                existing.scenes.push(...day.scenes);
                if (!existing.shootTime && day.shootTime) {
                    existing.shootTime = day.shootTime;
                }
                if (!existing.date && day.date) {
                    existing.date = day.date;
                }
            } else {
                merged.push(day);
            }
        }
        return merged;
    };

    if (days.length === 0) {
        return mergeDuplicateDays(parseOneLineScheduleFallback(text));
    }

    return mergeDuplicateDays(days);
}

function extractScenesFromDayBlock(rawLines: string[]): OneLineScene[] {
    const scenes: OneLineScene[] = [];

    // ---------------------------------------------------------------
    // Pre-pass: merge split scene headers.
    // Some PDFs break a scene entry across 2-3 lines, e.g.:
    //   "118/117"        ← scene number
    //   "PT"             ← modifier
    //   "EXT BUILDING"   ← the actual INT/EXT line
    // We detect this pattern and join them into one line before parsing.
    // ---------------------------------------------------------------
    const intExtRe = /^(INT\.|EXT\.|I\/E\.|INT\/EXT\.?|INT|EXT|I\/E)\s+/i;
    // Allow optional spaces, slashes, and modifier words (e.g. "56 PT/57") in scene-number-only lines
    const sceneNumOnlyRe = /^([0-9][A-Z0-9\/\-\.]*(?:\s+[A-Z0-9\/\-\.]+)*)\s*$/i;
    // Avoid matching lines that contain INT/EXT keywords as distinct words
    const intExtWordRe = /\b(INT\.|EXT\.|I\/E\.|INT\/EXT\.?|INT|EXT|I\/E)\b/i;
    // Known modifier tokens that can appear on their own line
    const modifierOnlyRe = /^(PT\d*|Start|End|Part|Partial|PTL|VFX|Contd|Cont['’]d|Cont|Con['’]t)\s*$/i;
    // Short stray token: 1–4 uppercase letters that are not a known INT/EXT keyword
    const shortStrayRe = /^[A-Z]{1,4}$/i;

    const lines: string[] = [];
    for (let k = 0; k < rawLines.length; k++) {
        const cur = rawLines[k];
        const next = rawLines[k + 1] ?? "";
        const afterNext = rawLines[k + 2] ?? "";

        if (sceneNumOnlyRe.test(cur) && !intExtWordRe.test(cur)) {
            if (modifierOnlyRe.test(next) && intExtRe.test(afterNext)) {
                // Pattern: "118/117" + "PT" + "EXT BUILDING ..."
                lines.push(`${cur.trim()} ${next.trim()} ${afterNext.trim()}`);
                k += 2;
                continue;
            }
            // Check for split modifier (e.g. cur ends in "P" and next is "T")
            if (cur.endsWith("P") && next.trim() === "T" && intExtRe.test(afterNext)) {
                lines.push(`${cur.trim()}T ${afterNext.trim()}`);
                k += 2;
                continue;
            }
            // Stray short token (e.g. "T") between scene number and INT/EXT
            if (shortStrayRe.test(next.trim()) && !modifierOnlyRe.test(next) && intExtRe.test(afterNext)) {
                // Drop the stray token, merge scene number directly with INT/EXT line
                lines.push(`${cur.trim()} ${afterNext.trim()}`);
                k += 2;
                continue;
            }
            if (intExtRe.test(next)) {
                // Pattern: "118/117" + "EXT BUILDING ..."
                lines.push(`${cur.trim()} ${next.trim()}`);
                k += 1;
                continue;
            }
        }

        if (modifierOnlyRe.test(cur) && intExtRe.test(next)) {
            // Orphaned modifier — attach to previous line's scene number and merge
            const prev = lines[lines.length - 1] ?? "";
            if (prev && !intExtRe.test(prev)) {
                lines[lines.length - 1] = `${prev.trim()} ${cur.trim()} ${next.trim()}`;
                k += 1;
                continue;
            }
        }

        lines.push(cur);
    }

    // ---------------------------------------------------------------
    // Find where the first real scene starts (for "day context")
    // ---------------------------------------------------------------
    const fullSceneRe = /^([A-Z0-9][\w\/\-\.\s\'’]*?(?:\s+(?:Start|End|PT|Part|Partial|PTL|VFX|Contd|Cont['’]d|Cont|Con['’]t))?)\s+(INT\.|EXT\.|I\/E\.|INT|EXT|I\/E|INT\/EXT)\s+(.+)/i;

    let firstSceneIndex = -1;
    for (let k = 0; k < lines.length; k++) {
        if (fullSceneRe.test(lines[k])) {
            firstSceneIndex = k;
            break;
        }
    }
    const dayContext = firstSceneIndex > 0 ? lines.slice(0, firstSceneIndex) : [];

    // ---------------------------------------------------------------
    // Main scene-extraction loop
    // ---------------------------------------------------------------
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const sceneHeaderMatch = line.match(fullSceneRe);

        if (sceneHeaderMatch) {
            const sceneNum = sceneHeaderMatch[1].trim();
            const intExt = sceneHeaderMatch[2].toUpperCase().replace(/\.$/, "");
            let location = sceneHeaderMatch[3].trim();
            let timeOfDay = "DAY";

            // Time-of-day extraction from location string (e.g. "... - NIGHT")
            const todMatch = location.match(/-\s*(DAY|NIGHT|DUSK|DAWN|CONT.*|LATER|MAGIC HOUR|TWILIGHT)/i);
            if (todMatch) {
                timeOfDay = todMatch[1].toUpperCase();
                location = location.replace(todMatch[0], "").trim();
            }

            // Collect description lines until the next scene header / footer
            let descriptionLines: string[] = [];
            let j = i + 1;
            while (j < lines.length) {
                const nextLine = lines[j];
                if (fullSceneRe.test(nextLine)) break;
                if (/^End of Day/i.test(nextLine)) break;
                if (/^Total Featured/i.test(nextLine)) break;
                descriptionLines.push(nextLine);
                j++;
            }

            // Check descriptionLines for an explicit TOD marker (e.g. standalone "NIGHT" line)
            if (timeOfDay === "DAY") {
                for (const dl of descriptionLines) {
                    if (/^(NIGHT|DUSK|DAWN)$/i.test(dl.trim())) {
                        timeOfDay = dl.trim().toUpperCase();
                        break;
                    }
                }
            }

            const combinedDescription = [
                ...dayContext,
                "-----------------------------------",
                line,
                ...descriptionLines
            ].join("\n").trim();

            scenes.push({ sceneNum, intExt, location, timeOfDay, description: combinedDescription });
            i = j - 1;
        }
    }

    return scenes;
}

function parseOneLineScheduleFallback(text: string): OneLineDay[] {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const days: OneLineDay[] = [];
    let currentDay: OneLineDay | null = null;

    const dayRe = /(?:^|\s)DAY\s+#?(\d+[A-Z]?)/i;
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
            currentDay = { shootDay: dm[1].toUpperCase(), isSecondUnit: /2ND|SECOND|2U/i.test(line), isSplinterUnit: /splinter|spl/i.test(line), date: dateStr, scenes: [] };
            days.push(currentDay as OneLineDay);
            continue;
        }
        if (!currentDay) continue;

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
