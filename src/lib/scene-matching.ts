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
