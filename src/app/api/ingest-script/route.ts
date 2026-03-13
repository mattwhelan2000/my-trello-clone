import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { extractText } from "unpdf";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file || file.type !== "application/pdf") {
            return NextResponse.json({ error: "Invalid or missing PDF file" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfBuffer = new Uint8Array(arrayBuffer);

        // Extract per-page to preserve structure
        const { text: pages, totalPages } = await extractText(pdfBuffer, { mergePages: false });
        const text = pages.join('\n');

        console.log("[SCRIPT INGEST] Total pages:", totalPages);
        console.log("[SCRIPT INGEST] Text length:", text.length);
        console.log("[SCRIPT INGEST] First 3000 chars:", text.substring(0, 3000));

        // Detect color from filename
        const filename = file.name.toUpperCase();
        let bgColor = "#f8fafc";
        if (filename.includes("BLUE")) bgColor = "#3b82f6";
        else if (filename.includes("PINK")) bgColor = "#ec4899";
        else if (filename.includes("YELLOW")) bgColor = "#eab308";
        else if (filename.includes("GREEN")) bgColor = "#22c55e";
        else if (filename.includes("GOLDENROD")) bgColor = "#ca8a04";
        else if (filename.includes("BUFF")) bgColor = "#d6d3d1";
        else if (filename.includes("SALMON")) bgColor = "#fb7185";
        else if (filename.includes("CHERRY")) bgColor = "#be123c";

        const boardTitle = file.name.replace(/\.pdf$/i, "");

        // Check if workspace exists
        let workspace = await db.workspace.findFirst();
        if (!workspace) {
            workspace = await db.workspace.create({
                data: { name: "My Workspace", members: ["default_user"] }
            });
        }

        // ========== ROBUST SCENE PARSING ==========
        // Use global regex on full text to find scene headings regardless of newline formatting.
        // Standard screenplay scene headings: "INT." or "EXT." or "INT./EXT." or "I/E."
        // Optionally preceded by a scene number and followed by location - time of day
        
        // This regex finds scene headings anywhere in the text, not just at line beginnings
        const globalSceneRegex = /(?:^|\n)\s*(?:(\d+[A-Z]?)\s+)?(?:(INT\.|EXT\.|INT\.\/EXT\.|INT\/EXT\.|I\/E\.)\s+)([\s\S]*?)(?=(?:\n\s*(?:\d+[A-Z]?\s+)?(?:INT\.|EXT\.|INT\.\/EXT\.|INT\/EXT\.|I\/E\.)\s)|$)/gi;

        // Also try a simpler approach: split the text at scene heading boundaries
        const sceneHeadingPattern = /(?:(\d+[A-Z]?)\s+)?(INT\.|EXT\.|INT\.\/EXT\.|INT\/EXT\.|I\/E\.)\s+/gi;
        
        // Find all scene heading positions
        const headingPositions: Array<{
            index: number;
            sceneNum: string;
            intExt: string;
            fullMatch: string;
        }> = [];

        let headingMatch;
        while ((headingMatch = sceneHeadingPattern.exec(text)) !== null) {
            headingPositions.push({
                index: headingMatch.index,
                sceneNum: headingMatch[1] || "",
                intExt: headingMatch[2],
                fullMatch: headingMatch[0]
            });
        }

        console.log("[SCRIPT INGEST] Found", headingPositions.length, "scene headings");
        
        if (headingPositions.length === 0) {
            // Log some text samples to help debug
            console.log("[SCRIPT INGEST] No headings found. Checking for INT/EXT keywords...");
            const intExtCount = (text.match(/\b(INT|EXT)\b/gi) || []).length;
            console.log("[SCRIPT INGEST] Found", intExtCount, "INT/EXT keywords in text");
            
            // Return debug info
            const board = await db.board.create({
                data: {
                    title: boardTitle,
                    workspaceId: workspace.id,
                    bgColor
                }
            });
            
            revalidatePath("/");
            return NextResponse.json({ 
                boardId: board.id, 
                warning: `No scenes detected. PDF had ${totalPages} pages and ${text.length} chars. Found ${intExtCount} INT/EXT keywords but no standard scene headings.`,
                textSample: text.substring(0, 500)
            });
        }

        // Parse each scene from the heading positions
        interface SceneData {
            number: string;
            isAutoNumbered: boolean;
            intExt: string;
            location: string;
            timeOfDay: string;
            bodyLength: number;
        }

        const scenes: SceneData[] = [];
        let autoCounter = 1;

        for (let i = 0; i < headingPositions.length; i++) {
            const heading = headingPositions[i];
            const nextHeading = headingPositions[i + 1];

            // Extract the text between this heading and the next one
            const headingEndIndex = heading.index + heading.fullMatch.length;
            const sceneEndIndex = nextHeading ? nextHeading.index : text.length;
            const sceneBody = text.substring(headingEndIndex, sceneEndIndex);

            // Parse location and time of day from the first line after INT./EXT.
            const firstLineEnd = sceneBody.indexOf('\n');
            const headingLine = firstLineEnd > -1 ? sceneBody.substring(0, firstLineEnd).trim() : sceneBody.trim();

            let location = "UNKNOWN LOCATION";
            let timeOfDay = "UNKNOWN TIME";

            // Split on " - " to separate location from time of day
            const dashParts = headingLine.split(/\s+-\s+/);
            if (dashParts.length > 1) {
                timeOfDay = dashParts.pop()?.trim() || "UNKNOWN TIME";
                location = dashParts.join(' - ').trim();
            } else if (headingLine) {
                location = headingLine.trim();
            }

            // Clean up location - remove trailing scene numbers
            location = location.replace(/\s+\d+[A-Z]?\s*$/, "").trim();
            if (!location) location = "UNKNOWN LOCATION";

            // Determine scene number
            let sceneNum = heading.sceneNum;
            let isAuto = false;

            if (!sceneNum) {
                sceneNum = `${autoCounter++}`;
                isAuto = true;
            } else {
                const parsedNum = parseInt(sceneNum.replace(/\D/g, ''));
                if (!isNaN(parsedNum) && parsedNum >= autoCounter) {
                    autoCounter = parsedNum + 1;
                }
            }

            // Estimate body length for page-eighths calculation
            const bodyLines = sceneBody.split('\n').filter((l: string) => l.trim().length > 0);

            scenes.push({
                number: sceneNum,
                isAutoNumbered: isAuto,
                intExt: heading.intExt.toUpperCase(),
                location: location.toUpperCase(),
                timeOfDay: timeOfDay.toUpperCase().replace(/\s+\d+[A-Z]?\s*$/, ""),
                bodyLength: bodyLines.length
            });
        }

        console.log("[SCRIPT INGEST] Parsed", scenes.length, "scenes. First 3 scenes:", JSON.stringify(scenes.slice(0, 3), null, 2));

        // Create the board
        const board = await db.board.create({
            data: {
                title: boardTitle,
                workspaceId: workspace.id,
                bgColor
            }
        });

        // Create lists and cards for each scene
        let listOrder = 0;
        for (const scene of scenes) {
            let eighths = Math.max(1, Math.ceil(scene.bodyLength / 6));
            let pgs = Math.floor(eighths / 8);
            eighths = eighths % 8;

            let lengthStr = pgs > 0 ? `${pgs}` : "";
            if (eighths > 0) lengthStr += lengthStr ? `+${eighths}/8` : `${eighths}/8`;
            if (!lengthStr) lengthStr = "1/8";

            const titleAutoFlag = scene.isAutoNumbered ? "[AUTO] " : "";
            const listTitle = `Sc${scene.number} ${titleAutoFlag}${scene.intExt} -- ${lengthStr} pgs`;

            const list = await db.list.create({
                data: { title: listTitle, boardId: board.id, order: listOrder++ }
            });

            await db.card.create({ data: { title: scene.location, listId: list.id, order: 0, color: "#bae6fd" } });
            await db.card.create({ data: { title: scene.timeOfDay, listId: list.id, order: 1, color: "#fef08a" } });
            await db.card.create({ data: { title: "SET LOCATION", listId: list.id, order: 2, color: "#bbf7d0" } });
            await db.card.create({ data: { title: "VFX", listId: list.id, order: 3, color: "#fecaca" } });
        }

        revalidatePath("/");
        return NextResponse.json({ boardId: board.id, scenesCreated: scenes.length });

    } catch (error: any) {
        console.error("Script ingestion failed:", error);
        return NextResponse.json({ error: `Failed to ingest script: ${error.message}` }, { status: 500 });
    }
}
