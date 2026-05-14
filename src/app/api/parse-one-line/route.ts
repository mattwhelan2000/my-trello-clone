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
    shootTime?: string;     // e.g. "CREW CALL: 6AM - LUNCH:12.00PM - CAMERA WRAP: 5.30 PM"
    scenes: OneLineScene[];
}

// -------------------------------------------------------------------
// Core parser — updated to handle the specific format provided
// -------------------------------------------------------------------
function parseOneLineSchedule(text: string): OneLineDay[] {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const days: OneLineDay[] = [];
    let currentDay: OneLineDay | null = null;

    // Patterns
    // "DAY #1 - MON, JUNE 1ST/ Sun: ..."
    const dayStartRe = /^DAY\s+#?(\d+[A-Z]?)/i;
    // "End of Day# 1 -- Monday, June 1, 2026"
    const dayEndRe = /^End of Day/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const dayMatch = line.match(dayStartRe);
        if (dayMatch) {
            const shootDay = dayMatch[1].toUpperCase();
            const is2U = /2ND|SECOND|2U/i.test(line);

            // try to get date from start line
            const dateMatch = line.match(/(?:MON|TUE|WED|THU|FRI|SAT|SUN)\w*,?\s+(JAN\w*|FEB\w*|MAR\w*|APR\w*|MAY|JUN\w*|JUL\w*|AUG\w*|SEP\w*|OCT\w*|NOV\w*|DEC\w*)\s+\d{1,2}(?:ST|ND|RD|TH)?/i);
            const rawDate = dateMatch ? dateMatch[0] : "";

            // check for shoot times on the next few lines
            let times = "";
            for (let j = 1; j <= 2 && i + j < lines.length; j++) {
                if (/CREW CALL|LUNCH|WRAP/i.test(lines[i + j])) {
                    times = lines[i + j];
                    break;
                }
            }

            currentDay = {
                shootDay,
                isSecondUnit: is2U,
                date: rawDate,
                shootTime: times,
                scenes: []
            };
            days.push(currentDay);
            continue;
        }

        if (dayEndRe.test(line) && currentDay) {
            // Real date often in footer: "End of Day# 1 -- Monday, June 1, 2026 -- 3 3/8 Pages"
            const realDateMatch = line.match(/--\s*((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[A-Za-z,\s0-9]+)\s*--/i);
            if (realDateMatch) {
                currentDay.date = realDateMatch[1].trim();
            }
            currentDay = null;
            continue;
        }

        if (!currentDay) continue;

        // Scene Heading detection
        // Format: "24A I/E THE ARMORY BUILDING" or "43 EXT THE ARMORY BUILDING" or "60 Start EXT ..."
        const sceneHeadingRe = /^([A-Z0-9]+(?:[-A-Z0-9/]+)*)?\s*(?:START|PART|CONT|PT|PARTIAL)?\s*(INT\.|EXT\.|I\/E\.|INT\/EXT\.?|INT|EXT|I\/E)\s+(.+)/i;
        let headingMatch = line.match(sceneHeadingRe);

        // Handle split headings or missing scene numbers
        if (!headingMatch && /^(INT\.|EXT\.|I\/E\.|INT|EXT|I\/E)\s+(.+)/i.test(line)) {
            const h2 = line.match(/^(INT\.|EXT\.|I\/E\.|INT|EXT|I\/E)\s+(.+)/i);
            let sNum = "?";
            if (i > 0 && /^[A-Z0-9/-]+$/.test(lines[i - 1].replace(/\s/g, ""))) {
                sNum = lines[i - 1].trim();
            }
            if (h2) headingMatch = [line, sNum, h2[1], h2[2]];
        }

        if (headingMatch) {
            let sceneNum = headingMatch[1] ? headingMatch[1].trim() : "?";
            sceneNum = sceneNum.replace(/start/i, "").trim();

            const intExt = headingMatch[2].toUpperCase().replace(/\.$/, "");
            let location = headingMatch[3].trim();
            let timeOfDay = "DAY";

            // Extract time of day if it's on the same line (e.g. "... - DAY")
            const todMatch = location.match(/-\s*(DAY|NIGHT|DUSK|DAWN|CONT.*|LATER|MAGIC HOUR|TWILIGHT)/i);
            if (todMatch) {
                timeOfDay = todMatch[1].toUpperCase();
                location = location.replace(todMatch[0], "").trim();
            } else {
                // Peek next lines for TOD like "DAY Pgs" or "NIGHT Pgs"
                for (let j = 1; j <= 3 && i + j < lines.length; j++) {
                    const nextL = lines[i + j];
                    if (/^(DAY|NIGHT|DUSK|DAWN|CONT.*|LATER)/i.test(nextL)) {
                        timeOfDay = nextL.split(/\s+/)[0].toUpperCase();
                        break;
                    }
                    if (nextL.includes("DAY Pgs") || nextL.includes("NIGHT Pgs")) {
                        timeOfDay = nextL.includes("NIGHT") ? "NIGHT" : "DAY";
                        break;
                    }
                }
            }

            // Description extraction
            let desc = "";
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                // If it's not a heading or metadata line, it's a description
                if (!/^(DAY|NIGHT|DUSK|DAWN|X=|F=|BG=|P=|INT|EXT)/i.test(nextLine) && !/^\d+\s+(INT|EXT)/i.test(nextLine)) {
                    desc = nextLine.replace(/\d+\s*\d*\/\d*\s*$/, "").trim(); // Strip page counts
                }
            }

            currentDay.scenes.push({
                sceneNum,
                intExt,
                location,
                timeOfDay,
                description: desc
            });
        }
    }

    if (days.length === 0) {
        return parseOneLineScheduleFallback(text);
    }

    return days;
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
            currentDay = { shootDay: dm[1].toUpperCase(), isSecondUnit: /2ND|SECOND|2U/i.test(line), date: dateStr, scenes: [] };
            days.push(currentDay);
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
