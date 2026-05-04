"use server";

const pdf = require("pdf-parse");
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { IngestScriptSchema } from "./schema";

export const ingestScriptAction = actionClient
    .schema(IngestScriptSchema)
    .action(async ({ parsedInput: { formData } }) => {
        try {
            const file = formData.get("file") as File;
            if (!file) {
                throw new Error("No PDF file uploaded");
            }

            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const pdfData = await pdf(buffer);
            const text = pdfData.text;

            // Detect color from filename
            const filename = file.name.toUpperCase();
            let bgColor = "#f8fafc"; // Default White
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

            // Create the DB Board
            const board = await db.board.create({
                data: {
                    title: boardTitle,
                    workspaceId: workspace.id,
                    bgColor
                }
            });

            const lines = text.split('\n');
            let currentScene: any = null;
            const scenes: any[] = [];
            let autoCounter = 1;

            const sceneHeadingRegex = /^\s*(?:([0-9A-Z]+)\s+)?(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s+(.*?)(?:\s+-\s+(.*?))?(?:\s+([0-9A-Z]+))?\s*$/i;
            const looseHeadingRegex = /^\s*(?:[0-9A-Z]+\s+)?(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                if (looseHeadingRegex.test(line)) {
                    if (currentScene) {
                        scenes.push(currentScene);
                    }

                    const match = line.match(sceneHeadingRegex);
                    
                    let sceneNum = "";
                    let intExt = "INT.";
                    let location = "UNKNOWN LOCATION";
                    let timeOfDay = "UNKNOWN TIME";
                    let isAuto = false;

                    if (match) {
                        sceneNum = match[1] || match[5] || "";
                        intExt = match[2];
                        location = match[3] || "UNKNOWN LOCATION";
                        timeOfDay = match[4] || "UNKNOWN TIME";
                    } else {
                        // Fallback parsing
                        intExt = line.match(/(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i)?.[0] || "INT.";
                        const noPrefix = line.replace(/^(?:[0-9A-Z]+\s+)?(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i, "").trim();
                        const parts = noPrefix.split('-');
                        if (parts.length > 1) {
                            timeOfDay = parts.pop()?.trim() || "UNKNOWN TIME";
                            location = parts.join('-').trim();
                        } else {
                            location = noPrefix;
                        }
                    }

                    location = location.replace(/\s+[0-9A-Z]+$/, "");

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
                        intExt: intExt.toUpperCase(),
                        location: location.toUpperCase(),
                        timeOfDay: timeOfDay.toUpperCase(),
                        lineCount: 0
                    };
                } else {
                    if (currentScene) {
                        currentScene.lineCount++;
                    }
                }
            }

            if (currentScene) {
                scenes.push(currentScene);
            }

            let listOrder = 0;
            for (const scene of scenes) {
                let eighths = Math.max(1, Math.ceil(scene.lineCount / 6));
                let pages = Math.floor(eighths / 8);
                eighths = eighths % 8;
                
                let lengthStr = pages > 0 ? `${pages}` : "";
                if (eighths > 0) {
                    lengthStr += lengthStr ? `+${eighths}/8` : `${eighths}/8`;
                }
                if (!lengthStr) lengthStr = "1/8";

                const titleAutoFlag = scene.isAutoNumbered ? "[AUTO]" : "";
                const listTitle = `Sc${scene.number} ${titleAutoFlag} ${scene.intExt} -- ${lengthStr} pgs`;

                const list = await db.list.create({
                    data: {
                        title: listTitle,
                        boardId: board.id,
                        order: listOrder++,
                    }
                });

                // 1) Scene Location CARD (LIGHT BLUE)
                await db.card.create({
                    data: { title: scene.location, listId: list.id, order: 0, color: "#bae6fd" }
                });
                
                // 2) Time of Day Card (YELLOW)
                await db.card.create({
                    data: { title: scene.timeOfDay, listId: list.id, order: 1, color: "#fef08a" }
                });

                // 3) SET LOCATION Card (GREEN)
                await db.card.create({
                    data: { title: "SET LOCATION", listId: list.id, order: 2, color: "#bbf7d0" }
                });

                // 4) VFX Card (RED)
                await db.card.create({
                    data: { title: "VFX", listId: list.id, order: 3, color: "#fecaca" }
                });
            }

            revalidatePath("/");
            return { boardId: board.id };
        } catch (error: any) {
            return { error: `Failed to ingest script: ${error.message}` };
        }
    });
