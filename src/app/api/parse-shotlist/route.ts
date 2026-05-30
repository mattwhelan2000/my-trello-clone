import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        let text = "";

        const contentType = req.headers.get("content-type") || "";
        if (contentType.includes("multipart/form-data")) {
            const formData = await req.formData();
            const file = formData.get("file") as File | null;
            if (!file) {
                return NextResponse.json({ error: "No file provided." }, { status: 400 });
            }
            const arrayBuffer = await file.arrayBuffer();
            const pdfBuffer = new Uint8Array(arrayBuffer);
            const { text: pages } = await extractText(pdfBuffer, { mergePages: false });
            text = pages.join("\n");
        } else {
            const body = await req.json();
            const url = body.url;
            if (!url) {
                return NextResponse.json({ error: "No URL or file provided." }, { status: 400 });
            }
            // If it's a Dropbox link, ensure it downloads directly
            let fetchUrl = url;
            if (fetchUrl.includes("dropbox.com")) {
                fetchUrl = fetchUrl.replace("dl=0", "dl=1");
                if (!fetchUrl.includes("dl=1")) {
                    fetchUrl += (fetchUrl.includes("?") ? "&" : "?") + "dl=1";
                }
            }

            const res = await fetch(fetchUrl);
            if (!res.ok) {
                throw new Error(`Failed to fetch PDF from URL: ${res.statusText}`);
            }
            const arrayBuffer = await res.arrayBuffer();
            const pdfBuffer = new Uint8Array(arrayBuffer);
            const { text: pages } = await extractText(pdfBuffer, { mergePages: false });
            text = pages.join("\n");
        }

        const result = parseShotlist(text);

        return NextResponse.json({ scenes: result.scenes });
    } catch (e: any) {
        console.error("[PARSE-SHOTLIST] Error:", e);
        return NextResponse.json({ error: e.message || "Unknown error" }, { status: 500 });
    }
}

export interface ShotlistShot {
    shotNumber: string;
    description: string;
    lensAndCamera?: string;
}

export interface ShotlistPart {
    partName: string;
    notes?: string;
    shots: ShotlistShot[];
}

export interface ShotlistScene {
    sceneHeading: string;
    sceneNum: string; // Extracted
    notes?: string;
    parts: ShotlistPart[];
}

function parseShotlist(text: string) {
    const sceneRegex = /^SC\s+[\d\s&,\-]+.*/i;
    const partRegex = /^(Pt|Part)\s*\d+.*/i;
    const shotRegex = /^(\d+[A-Z]?)\.\s+(.*)/;
    const lensRegex = /(\b\d{2,3}mm.*)$/i;
    
    // Extract base scene num: e.g. "SC 1 & 2 - EXT" -> "1"
    const extractSceneNum = (heading: string) => {
        const match = heading.match(/^SC\s+(\d+[A-Z]*)/i);
        return match ? match[1] : "";
    };

    const projectData = { scenes: [] as ShotlistScene[] };
    
    let currentScene: ShotlistScene | null = null;
    let currentPart: ShotlistPart | null = null;
    let currentShot: ShotlistShot | null = null;

    const lines = text.split('\n');

    for (let rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (sceneRegex.test(line)) {
            currentPart = { partName: "Default", notes: "", shots: [] };
            currentScene = {
                sceneHeading: line,
                sceneNum: extractSceneNum(line),
                notes: "",
                parts: [currentPart]
            };
            projectData.scenes.push(currentScene);
            currentShot = null;
            continue;
        }

        if (partRegex.test(line)) {
            if (currentScene) {
                currentPart = { partName: line, notes: "", shots: [] };
                currentScene.parts.push(currentPart);
                currentShot = null;
            }
            continue;
        }

        const shotMatch = line.match(shotRegex);
        if (shotMatch) {
            if (currentPart) {
                currentShot = {
                    shotNumber: shotMatch[1],
                    description: shotMatch[2],
                    lensAndCamera: ""
                };
                currentPart.shots.push(currentShot);
            }
            continue;
        }

        // Continuation lines
        if (currentShot) {
            currentShot.description += ` ${line}`;
        } else if (currentPart && currentPart.partName !== "Default") {
            currentPart.notes = currentPart.notes ? `${currentPart.notes} ${line}` : line;
        } else if (currentScene) {
            currentScene.notes = currentScene.notes ? `${currentScene.notes} ${line}` : line;
        }
    }

    // Post-processing for lens/camera and cleanup
    for (const scene of projectData.scenes) {
        if (!scene.notes) delete scene.notes;
        for (const part of scene.parts) {
            if (!part.notes) delete part.notes;
            for (const shot of part.shots) {
                const lensMatch = shot.description.match(lensRegex);
                if (lensMatch) {
                    shot.lensAndCamera = lensMatch[1].trim();
                    shot.description = shot.description.replace(lensMatch[1], "").trim();
                } else {
                    delete shot.lensAndCamera;
                }
            }
        }
    }

    return projectData;
}
