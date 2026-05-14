const fs = require('fs');

const text = `DAY #1 - MON, JUNE 1ST/ Sun: 4.12/4.51 am - 8.32/9.12 pm 
CREW CALL: 6AM - LUNCH:12.00PM - CAMERA WRAP: 5.30 PM 
- ARMORY BUILDING - YAFFA DELI AFTERMATH - 
24A I/E THE ARMORY BUILDING - YAFFA DELI (AFTERMATH)
COPS firing at the baddies...BLONDE BADDIES obliterate the cop cars. 1/8
DAY Pgs BACKLOT
X=120
F=1
BG=9 ADC, PA5 100, 134, 135, 158, 161, 169, 176
P=4 AC
43 EXT THE ARMORY BUILDING - YAFFA DELI (AFTERMATH)
KAT KELLY arrives on the scene. 1 5/8
DAY Pgs BACKLOT
X=246
5, 7, 8, 13, 17, 22 F=9
BG=4 100, 105, 151, 155, 159, 160, 167A
P=23 T30
50A EXT THE ARMORY BUILDING
Shots of the explosion from outside the building. 1/8
DAY Pgs BACKLOT
X=246
F=9
BG=4 ADC 100, 151, 152, 155, 159, 160
P=23 AC, Dr, Lift
52 EXT THE ARMORY BUILDING
CAPTAIN KEMPER tells KAT to stand down. 7/8
DAY Pgs BACKLOT
X=246
5, 7, 8 F=9
BG=4
100, 151, 152, 155, 159, 160
P=25
54 EXT THE ARMORY BUILDING
KAT answers a call from her dad. 2/8
DAY Pgs BACKLOT
X=246
5, 7, 8 F=9
BG=4 100, 151, 152, 155, 159, 160
P=25
56 PT/57 
PT
EXT THE ARMORY BUILDING
INTERCUT: KAT is talking w/ Jack & her Dad. 1/8
DAY Pgs BACKLOT
X=246
5, 7, 8 F=9
BG=4
100, 151, 152, 155, 159, 160
P=25
58 EXT THE ARMORY BUILDING
KAT realizes her dad is on his way. 1/8
DAY Pgs BACKLOT
X=246
5, 7, 8 F=9
BG=8 100, 151, 152, 155, 159, 160
P=25
59 PT EXT THE ARMORY BUILDING
Decker's Security CAM: SWAT vehicles & PolIce Cars roll toward the building... 1/8
DAY Pgs BACKLOT
X=246
5, 7, 8 F=9
BG=8 100, 151, 152, 155, 159, 160
P=25
Total Featured: 9 - Total Extras: 248 
End of Day# 1 -- Monday, June 1, 2026 -- 3 3/8 Pages
DAY #2 - TUES, JUNE 2ND/ Sun: 4.11/4.50 am - 8.33/9.13 pm 
CREW CALL: 7AM - LUNCH:1.00PM - CAMERA WRAP: 6.30 PM 
- ARMORY BUILDING - 
60 Start EXT THE ARMORY BUILDING
Cops see on billboard screens Decker's masked face. Baddies opens fire on the 1
DAY Pgs BACKLOT
X=314
5, 7, 8, 12 F=19
BG=4 ADC, PA5 100, 105, 107, 108, 139, 140, 141, 151, 152, 
155, 159, 160
P=32 AC
Total Featured: 19 - Total Extras: 314 
End of Day# 2 -- Tuesday, June 2, 2026 -- 1 Pages`;

function parseOneLineSchedule(text) {
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const days = [];
    let currentDay = null;

    // Pattern for start of day
    // "DAY #1 - MON, JUNE 1ST/ Sun: ..."
    const dayStartRe = /^DAY\s+#?(\d+[A-Z]?)/i;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const dayMatch = line.match(dayStartRe);
        if (dayMatch) {
            // We found a new day
            // E.g. "DAY #1 - MON, JUNE 1ST/ Sun: 4.12/4.51 am - 8.32/9.12 pm"
            const shootDay = dayMatch[1].toUpperCase();
            const is2U = /2ND|SECOND|2U/i.test(line);

            // try to get date
            const dateMatch = line.match(/(?:MON|TUE|WED|THU|FRI|SAT|SUN)\w*,?\s+(JAN\w*|FEB\w*|MAR\w*|APR\w*|MAY|JUN\w*|JUL\w*|AUG\w*|SEP\w*|OCT\w*|NOV\w*|DEC\w*)\s+\d{1,2}(?:ST|ND|RD|TH)?/i);
            const rawDate = dateMatch ? dateMatch[0] : "";
            
            // Check for shoot times on the next few lines:
            let times = "";
            for (let j = 1; j <= 2 && i + j < lines.length; j++) {
                if (/CREW CALL|LUNCH|WRAP/i.test(lines[i+j])) {
                    times = lines[i+j];
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

        if (/^End of Day/i.test(line) && currentDay) {
            // Sometimes the real date is here e.g. "End of Day# 1 -- Monday, June 1, 2026"
            const realDateMatch = line.match(/--\s*((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[A-Za-z,\s0-9]+)\s*--/i);
            if (realDateMatch && currentDay) {
                currentDay.date = realDateMatch[1].trim();
            }
            currentDay = null;
            continue;
        }

        if (!currentDay) continue;

        // "24A I/E THE ARMORY BUILDING - YAFFA DELI (AFTERMATH)"
        // "43 EXT THE ARMORY BUILDING - YAFFA DELI (AFTERMATH)"
        // "56 PT/57 \n PT \n EXT THE ARMORY BUILDING" - this can get messy, but standard heading applies
        const sceneHeadingRe = /^([A-Z0-9]+(?:[-A-Z0-9/]+)*)?\s*(INT\.|EXT\.|I\/E\.|INT\/EXT\.?|INT|EXT|I\/E)\s+(.+)/i;
        
        let headingMatch = line.match(sceneHeadingRe);
        
        // Handle split headings where scene number is on a previous line, e.g. "56 PT/57 \n PT \n EXT THE ARMORY BUILDING"
        if (!headingMatch && /^(INT\.|EXT\.|I\/E\.|INT|EXT|I\/E)\s+(.+)/i.test(line)) {
            const h2 = line.match(/^(INT\.|EXT\.|I\/E\.|INT|EXT|I\/E)\s+(.+)/i);
            // try to look back 1 or 2 lines for the scene number
            let sNum = "?";
            if (i > 0 && /^[A-Z0-9/-]+$/.test(lines[i-1].replace(/\s/g, ""))) {
                sNum = lines[i-1].trim();
            }
            headingMatch = [line, sNum, h2[1], h2[2]];
        }

        if (headingMatch) {
            let sceneNum = headingMatch[1] ? headingMatch[1].trim() : "?";
            // remove "Start" from sceneNum if present e.g. "60 Start"
            sceneNum = sceneNum.replace(/start/i, "").trim();

            const intExt = headingMatch[2].toUpperCase().replace(/\.$/, "");
            let location = headingMatch[3].trim();
            let timeOfDay = "DAY"; // Default or parsed from next line

            // Extract time of day if it's on the next line or end of this line
            const timeMatch = location.match(/-\s*(DAY|NIGHT|DUSK|DAWN|CONT.*|LATER|MAGIC HOUR|TWILIGHT)/i);
            if (timeMatch) {
                timeOfDay = timeMatch[1].toUpperCase();
                location = location.replace(timeMatch[0], "").trim();
            } else {
                // Peek at next lines for TOD
                for(let j=1; j<=3 && i+j < lines.length; j++){
                    const nextL = lines[i+j];
                    if (/^(DAY|NIGHT|DUSK|DAWN|CONT.*|LATER)/i.test(nextL)){
                        timeOfDay = nextL.split(/\s+/)[0].toUpperCase();
                        break;
                    }
                    if (nextL.includes("DAY Pgs") || nextL.includes("NIGHT Pgs")) {
                        timeOfDay = nextL.includes("NIGHT") ? "NIGHT" : "DAY";
                        break;
                    }
                }
            }

            // Description is usually the line immediately following the heading
            let desc = "";
            if (i + 1 < lines.length) {
                const nextLine = lines[i+1];
                if (!/^(DAY|NIGHT|DUSK|DAWN|X=|F=|BG=|P=|INT|EXT)/i.test(nextLine) && !/^\d+\s+(INT|EXT)/i.test(nextLine)) {
                    // It's likely a description
                    // Strip off page counts like "1/8" or "1 5/8" from the end
                    desc = nextLine.replace(/\d+\s*\d*\/\d*\s*$/, "").trim();
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
    return days;
}

const result = parseOneLineSchedule(text);
console.log(JSON.stringify(result, null, 2));
