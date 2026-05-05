
export function extractNumbers(str: string): number[] {
    return (str.match(/\d+/g) || []).map(Number);
}

export function fuzzyMatchList(prefix: string, listTitle: string): boolean {
    const prefixNums = extractNumbers(prefix);
    const listNums = extractNumbers(listTitle);
    if (prefixNums.length === 0 || listNums.length === 0) return false;
    return prefixNums[0] === listNums[0];
}

export function parseFilename(name: string) {
    const nameWithoutExt = name.replace(/\.[^/.]+$/, "");
    
    // Support multiple delimiters: Sc001_Title, Sc001 Title, Sc001-Title, Sc001 - Title
    let delimiter = " ";
    if (nameWithoutExt.includes("_")) delimiter = "_";
    else if (nameWithoutExt.includes(" - ")) delimiter = " - ";
    else if (nameWithoutExt.includes("-")) {
        // Only use - as delimiter if it looks like a prefix split, not a word hyphen
        const parts = nameWithoutExt.split("-");
        if (parts[0].match(/[a-zA-Z]*\d+/) || parts[0].length < 10) {
            delimiter = "-";
        }
    }
    
    const parts = nameWithoutExt.split(delimiter);
    if (parts.length > 1) {
        return { scenePrefix: parts[0].trim(), cardName: parts.slice(1).join(delimiter).trim() };
    }
    return { scenePrefix: null, cardName: nameWithoutExt.trim() };
}
