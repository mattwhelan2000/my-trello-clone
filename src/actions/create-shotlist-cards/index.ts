"use server";

import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateShotlistCardsSchema } from "./schema";
import { revalidatePath } from "next/cache";
import { fuzzyMatchList, parseSceneToken } from "@/lib/scene-matching";

export const createShotlistCards = actionClient
    .schema(CreateShotlistCardsSchema)
    .action(async ({ parsedInput: { boardId, scenes, lists, duplicateToAllParts, globalColor, globalLabel, globalLabelColor } }) => {
        const logs: string[] = [];
        const cardsToInsert: any[] = [];
        const checklistsToInsert: any[] = [];
        const checklistItemsToInsert: any[] = [];
        const labelsToInsert: any[] = [];

        logs.push(`Starting shotlist import for board ${boardId}.`);
        logs.push(`Processing ${scenes.length} scenes.`);

        const boardTargetLists = new Map<string, string[]>(); // sceneNum -> listIds

        for (const scene of scenes) {
            const sceneNum = scene.sceneNum;
            if (!sceneNum) continue;

            const baseListId = fuzzyMatchList(sceneNum, lists);
            if (!baseListId) {
                logs.push(`⚠ WARNING: Scene ${sceneNum} could not be matched to any list and will be skipped.`);
                continue;
            }

            let targetListIds = [baseListId];

            if (duplicateToAllParts) {
                const parsedTarget = parseSceneToken(sceneNum);
                if (parsedTarget) {
                    const allParts = lists.filter(l => {
                        const parsedList = parseSceneToken(l.title);
                        return parsedList && parsedList.numInt === parsedTarget.numInt && parsedList.suffix === parsedTarget.suffix;
                    }).map(l => l.id);
                    if (allParts.length > 0) {
                        targetListIds = allParts;
                    }
                }
            }

            boardTargetLists.set(sceneNum, targetListIds);
        }

        // Fetch existing card max orders to place new cards at the bottom
        const existingCards = await db.card.findMany({
            where: { listId: { in: Array.from(boardTargetLists.values()).flat() } },
            select: { listId: true, order: true },
        });

        const listMaxOrder: Record<string, number> = {};
        for (const card of existingCards) {
            if (listMaxOrder[card.listId] === undefined || card.order > listMaxOrder[card.listId]) {
                listMaxOrder[card.listId] = card.order;
            }
        }

        let createdCount = 0;

        for (const scene of scenes) {
            const sceneNum = scene.sceneNum;
            if (!sceneNum) continue;

            const targetListIds = boardTargetLists.get(sceneNum);
            if (!targetListIds) continue;

            for (const listId of targetListIds) {
                const currentMax = listMaxOrder[listId] || 0;
                const newOrder = currentMax + 1;
                listMaxOrder[listId] = newOrder;

                const cardId = crypto.randomUUID();
                
                // Build a short description
                const desc = `**Shotlist for Scene ${sceneNum}**\n${scene.notes ? `*Notes: ${scene.notes}*` : ""}`;

                cardsToInsert.push({
                    id: cardId,
                    listId,
                    title: "SHOTLIST",
                    description: desc,
                    order: newOrder,
                    color: globalColor !== undefined && globalColor !== null ? globalColor : "#f59e0b",
                    fontColor: globalColor ? undefined : "#ffffff", // Default has white text, but standard colors handle it natively if set as globalColor
                    isSyncedWithSheet: false,
                });

                if (globalLabel) {
                    labelsToInsert.push({
                        id: crypto.randomUUID(),
                        cardId,
                        title: globalLabel,
                        color: globalLabelColor || globalColor || "#c084fc",
                    });
                }

                createdCount++;

                // Create checklists for each part
                for (const part of scene.parts) {
                    if (part.shots.length === 0) continue;
                    
                    const checklistId = crypto.randomUUID();
                    const title = part.partName === "Default" ? "Shots" : part.partName;
                    
                    checklistsToInsert.push({
                        id: checklistId,
                        cardId,
                        title,
                    });

                    // Add items
                    for (const shot of part.shots) {
                        const shotText = `[${shot.shotNumber}] ${shot.description}${shot.lensAndCamera ? ` (${shot.lensAndCamera})` : ""}`;
                        checklistItemsToInsert.push({
                            id: crypto.randomUUID(),
                            checklistId,
                            title: shotText,
                            isCompleted: false,
                        });
                    }
                }
            }
        }

        if (cardsToInsert.length === 0) {
            logs.push(`FAILED: No scenes could be matched to existing lists.`);
            return { error: "No scenes could be matched to existing lists.", logs };
        }

        await db.card.createMany({ data: cardsToInsert });
        if (labelsToInsert.length > 0) {
            await db.label.createMany({ data: labelsToInsert });
        }
        if (checklistsToInsert.length > 0) {
            await db.checklist.createMany({ data: checklistsToInsert });
            if (checklistItemsToInsert.length > 0) {
                await db.checklistItem.createMany({ data: checklistItemsToInsert });
            }
        }

        logs.push(`Successfully created ${createdCount} SHOTLIST cards.`);

        revalidatePath(`/board/${boardId}`);
        return { created: createdCount, logs };
    });
