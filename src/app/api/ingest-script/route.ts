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

        // ========== V2 SCENE PARSING (Line-by-Line) ==========
        const lines = text.split('\n');
        
        interface SceneData {
            number: string;
            isAutoNumbered: boolean;
            intExt: string;
            location: string;
            timeOfDay: string;
            description: string;
            bodyLength: number;
        }

        const scenes: SceneData[] = [];
        let currentScene: any = null;
        let autoCounter = 1;
        let lastStandaloneNumber = "";

        const timeOfDayList = ['DAY', 'NIGHT', 'CONTINUOUS', 'SAME', 'MOMENTS LATER', 'LATER', 'FOLLOWING'];

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];
            const line = rawLine.trim();
            if (!line) continue;
            
            // If the line is EXCLUSIVELY a number (like when unpdf splits a left-justified number onto its own line)
            // It can be a number surrounded by up to two letters, e.g. 15, 15A, AA15, 15Z
            if (/^[A-Za-z]{0,2}\d+[A-Za-z]?$/.test(line)) {
                lastStandaloneNumber = line;
            }
            
            let isHeading = false;
            let sceneNum = "";
            let headingText = "";
            
            // 1. Check if line starts with a number. Use a generous match for the rest of the line.
            // Screenplays generally have the scene number on the left.
            const numMatch = line.match(/^([A-Za-z]{0,2}\d+[A-Za-z]?)\s+(.+)$/);
            let content = line;

            if (numMatch) {
                sceneNum = numMatch[1];
                content = numMatch[2].trim();
                
                // Remove trailing scene number if it matches the leading one
                const trailingNumRegex = new RegExp(`\\s+${sceneNum}$`, 'i');
                if (trailingNumRegex.test(content)) {
                    content = content.replace(trailingNumRegex, '').trim();
                }
            } else {
                // Also remove trailing numbers if there are any just in case, like INT. BASEMENT - DAY 2
                const trailingNumMatch = content.match(/^(.*?)\s+([A-Za-z]{0,2}\d+[A-Za-z]?)$/);
                if (trailingNumMatch) {
                    // Only strip if what's left looks like a heading
                    if (/(INT\.|EXT\.|I\/E\.|INT\/EXT)/i.test(trailingNumMatch[1])) {
                        content = trailingNumMatch[1].trim();
                        // If we didn't have a flush-left number, we can use the flush-right one
                        if (!sceneNum) sceneNum = trailingNumMatch[2];
                    }
                }
            }

            // Is it undeniably a scene heading?
            if (/^(INT\.|EXT\.|I\/E\.|INT\/EXT)/i.test(content)) {
                isHeading = true;
            } else if (/^(CU\s|CLOSE UP\b|WIDE\b|ANGLE\b|POV\b)/i.test(content)) {
                isHeading = true;
            } else if (sceneNum && content.toUpperCase() === content && content.length > 2) {
                // If it had a number AND is all caps, it's likely a heading like "6 WYNN"
                isHeading = true;
            }
            
            if (isHeading) {
                headingText = content;
                
                // If we didn't capture a number on this line, see if the previous line was a standalone number
                if (!sceneNum && lastStandaloneNumber) {
                    sceneNum = lastStandaloneNumber;
                }
                
                // Reset since we've used it or passed it
                lastStandaloneNumber = "";
                
                let location = headingText;
                let timeOfDay = "";
                
                // 2. Parse exact Time of Day from hardcoded list
                const dashParts = headingText.split(/\s+-\s+/);
                if (dashParts.length > 1) {
                    const lastPart = dashParts[dashParts.length - 1].toUpperCase().trim();
                    for (const time of timeOfDayList) {
                        if (lastPart.includes(time)) {
                            timeOfDay = time;
                            dashParts.pop(); // Remove the time part from the location array
                            location = dashParts.join(" - ").trim();
                            break;
                        }
                    }
                }
                
                // 3. Extract INT/EXT prefix strictly. Set "N/A" if missing.
                let intExt = "N/A";
                const intExtMatch = location.match(/^(INT\.|EXT\.|I\/E\.|INT\/EXT)\s+/i);
                if (intExtMatch) {
                    intExt = intExtMatch[1].toUpperCase();
                    location = location.substring(intExtMatch[0].length).trim();
                }
                
                // Clean up any leading dash left over from extracting the intExt
                location = location.replace(/^-\s*/, "").trim();
                
                // Strip redundant trailing scene numbers or page numbers from the location
                location = location.replace(/\s+-\s+[A-Za-z]{0,2}\d+[A-Za-z]?$/, "").trim(); 
                location = location.replace(/\s+[A-Za-z]{0,2}\d+[A-Za-z]?$/, "").trim();
                location = location.replace(/\s+\d+$/, "").trim();
                location = location.replace(/\s+-$/, "").trim(); // Clean up any hanging dashes

                if (!location) location = "UNKNOWN LOCATION";

                // Auto numbering fallback
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

                currentScene = {
                    number: sceneNum,
                    isAutoNumbered: isAuto,
                    intExt: intExt,
                    location: location.toUpperCase(),
                    timeOfDay: timeOfDay,
                    description: "",
                    bodyLength: 0
                };
                scenes.push(currentScene);
                
                // 4. Extract Scene Description
                let descLines = [];
                let j = i + 1;
                // Skip immediate empty lines
                while (j < lines.length && lines[j].trim() === "") j++;
                
                while (j < lines.length) {
                    const nextLine = lines[j].trim();
                    if (nextLine === "") break; // Stop at first empty line after a text block
                    
                    const hasLetters = /[a-zA-Z]/.test(nextLine);
                    const isAllCaps = hasLetters && nextLine.toUpperCase() === nextLine;
                    
                    // Dialogue usually starts with a character name (ALL CAPS) or is heavily indented.
                    // If a line is ALL CAPS, or has significant leading spaces, it's NOT the scene description.
                    const leadingSpaces = lines[j].search(/\S/);
                    if (isAllCaps || leadingSpaces > 15) {
                        break; 
                    }
                    
                    descLines.push(nextLine);
                    j++;
                }
                
                currentScene.description = descLines.join(" ").trim();
                continue;
            }
            
            if (currentScene) {
                currentScene.bodyLength++;
            }
        }

        console.log("[SCRIPT INGEST] Parsed", scenes.length, "scenes. First 3 scenes:", JSON.stringify(scenes.slice(0, 3), null, 2));

        if (scenes.length === 0) {
            // Log some text samples to help debug
            console.log("[SCRIPT INGEST] No headings found. Checking for INT/EXT keywords...");
            const intExtCount = (text.match(/\b(INT|EXT)\b/gi) || []).length;
            
            // Return debug info
            const board = await db.board.create({
                data: { title: boardTitle, workspaceId: workspace.id, bgColor }
            });
            
            revalidatePath("/");
            return NextResponse.json({ 
                boardId: board.id, 
                warning: `No scenes detected. PDF had ${totalPages} pages and ${text.length} chars. Found ${intExtCount} INT/EXT keywords but no standard scene headings.`,
                textSample: text.substring(0, 500)
            });
        }

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

            await db.card.create({ data: { title: scene.location, listId: list.id, order: 0, color: "#bae6fd", description: scene.description } });
            await db.card.create({ data: { title: scene.timeOfDay || "N/A", listId: list.id, order: 1, color: "#fef08a" } });
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
