"use server";

import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateOneLineCardsSchema } from "./schema";
import { revalidatePath } from "next/cache";

import { fuzzyMatchList } from "@/lib/scene-matching";


export const createOneLineCards = actionClient
    .schema(CreateOneLineCardsSchema)
    .action(async ({ parsedInput: { boardId, days, lists, deleteExistingDayCards, splitListsForMultiDayScenes, cloneCardsInSplitLists } }) => {
        const logs: string[] = [];
        const cardsToInsert: any[] = [];
        const labelsToInsert: any[] = [];

        logs.push(`Starting import for board ${boardId}.`);
        logs.push(`Processing ${days.length} shooting days.`);

        // 1. Delete existing DAY/NIGHT cards if requested
        if (deleteExistingDayCards) {
            const deleted = await db.card.deleteMany({
                where: {
                    list: { boardId },
                    OR: [
                        {
                            labels: {
                                some: {
                                    title: {
                                        in: ["DAY", "NIGHT", "DUSK", "DAWN", "TWILIGHT", "LATER", "2ND UNIT"]
                                    }
                                }
                            }
                        },
                        { title: { startsWith: "DAY " } },
                        { title: { startsWith: "Day " } },
                        { title: { startsWith: "day " } },
                        { title: { startsWith: "DAY#" } },
                        { title: { startsWith: "Day#" } },
                        { title: { startsWith: "day#" } }
                    ]
                }
            });
            logs.push(`Deleted ${deleted.count} existing DAY/NIGHT cards.`);
        }

        // 2. Pre-calculate list splits for multi-day scenes
        const listDayUsage: Record<string, string[]> = {}; // listId -> unique day labels
        for (const day of days) {
            for (const scene of day.scenes) {
                if (scene.isOmitted || scene.listId === "omit") continue;
                const lid = scene.listId || fuzzyMatchList(scene.sceneNum, lists);
                if (!lid) {
                    logs.push(`⚠ WARNING: Scene ${scene.sceneNum} (Day ${day.shootDay}) could not be matched to any list and will be skipped.`);
                    continue;
                }
                if (!listDayUsage[lid]) listDayUsage[lid] = [];
                const unitSuffix = (day as any).isSplinterUnit ? "SPL" : day.isSecondUnit ? "2U" : "";
                const dayLabel = `${day.shootDay}${unitSuffix}`;
                if (!listDayUsage[lid].includes(dayLabel)) {
                    listDayUsage[lid].push(dayLabel);
                }
            }
        }

        const listIdOverrides: Record<string, string> = {}; // "listId-dayLabel" -> targetListId
        if (splitListsForMultiDayScenes) {
            logs.push(`Multi-day list splitting is ENABLED.`);
            for (const lid of Object.keys(listDayUsage)) {
                const dayLabels = listDayUsage[lid];
                if (dayLabels.length > 1) {
                    const originalList = await db.list.findUnique({ 
                        where: { id: lid },
                        include: { 
                            cards: {
                                include: {
                                    labels: true,
                                    checklists: {
                                        include: { items: true }
                                    }
                                }
                            }
                        }
                    });
                    if (!originalList) {
                        logs.push(`ERR: Original list ${lid} not found for splitting.`);
                        continue;
                    }
                    
                    const originalTitle = originalList.title;
                    const N = dayLabels.length;
                    logs.push(`Splitting list "${originalTitle}" into ${N} parts.`);

                    // Update original list title (User requested not to rename the first one)
                    listIdOverrides[`${lid}-${dayLabels[0]}`] = lid;

                    const newOrderStart = originalList.order + 1;
                    // Shift subsequent lists' order by N-1 to keep orders as Integers
                    await db.list.updateMany({
                        where: { boardId, order: { gte: newOrderStart } },
                        data: { order: { increment: N - 1 } }
                    });

                    // Create N-1 copies
                    for (let i = 1; i < N; i++) {
                        const newList = await db.list.create({
                            data: {
                                boardId,
                                title: `${originalTitle} Pt.${i+1}`,
                                order: originalList.order + i,
                            }
                        });
                        listIdOverrides[`${lid}-${dayLabels[i]}`] = newList.id;
                        logs.push(`Created part ${i+1}/${N}: "${newList.title}"`);

                        // Clone cards if requested
                        if (cloneCardsInSplitLists && originalList.cards.length > 0) {
                            logs.push(`Cloning ${originalList.cards.length} cards to "${newList.title}"`);
                            for (const card of originalList.cards) {
                                await db.card.create({
                                    data: {
                                        listId: newList.id,
                                        title: card.title,
                                        description: card.description,
                                        order: card.order,
                                        color: card.color,
                                        fontColor: card.fontColor,
                                        dueDate: card.dueDate,
                                        isSyncedWithSheet: card.isSyncedWithSheet,
                                        labels: {
                                            create: card.labels.map(l => ({
                                                title: l.title,
                                                color: l.color,
                                            }))
                                        },
                                        checklists: {
                                            create: card.checklists.map(c => ({
                                                title: c.title,
                                                items: {
                                                    create: c.items.map(item => ({
                                                        title: item.title,
                                                        isCompleted: item.isCompleted,
                                                    }))
                                                }
                                            }))
                                        }
                                    }
                                });
                            }
                        }
                    }
                }
            }
        }

        // 3. Pre-fetch existing card orders per list
        const targetListIds = new Set<string>();
        for (const day of days) {
            for (const scene of day.scenes) {
                if (scene.isOmitted || scene.listId === "omit") continue;
                const lid = scene.listId || fuzzyMatchList(scene.sceneNum, lists);
                if (lid) targetListIds.add(lid);
            }
        }
        Object.values(listIdOverrides).forEach(id => targetListIds.add(id));

        const existingCards = await db.card.findMany({
            where: { listId: { in: Array.from(targetListIds) } },
            select: { listId: true, order: true },
            orderBy: { order: "asc" }, // Order by asc to find min
        });

        const listMinOrder: Record<string, number> = {};
        for (const card of existingCards) {
            if (listMinOrder[card.listId] === undefined || card.order < listMinOrder[card.listId]) {
                listMinOrder[card.listId] = card.order;
            }
        }

        // Count how many new cards will be added to each list to calculate start offset
        const listNewCardCounts: Record<string, number> = {};
        const cardsByList: Record<string, any[]> = {};

        for (const day of days) {
            for (const scene of day.scenes) {
                if (scene.isOmitted || scene.listId === "omit") continue;
                const baseListId = scene.listId || fuzzyMatchList(scene.sceneNum, lists);
                if (!baseListId) continue;
                const unitSuffix = (day as any).isSplinterUnit ? "SPL" : day.isSecondUnit ? "2U" : "";
                const dayLabel = `${day.shootDay}${unitSuffix}`;
                const listId = listIdOverrides[`${baseListId}-${dayLabel}`] || baseListId;
                
                listNewCardCounts[listId] = (listNewCardCounts[listId] || 0) + 1;
                if (!cardsByList[listId]) cardsByList[listId] = [];
                cardsByList[listId].push({ day, scene });
            }
        }

        // Generate cards with correct orders (Top of list)
        for (const listId of Object.keys(cardsByList)) {
            const minOrder = listMinOrder[listId] ?? 0;
            const newCount = listNewCardCounts[listId];
            
            cardsByList[listId].forEach((item, index) => {
                const { day, scene } = item;
                
                const isNight = /NIGHT|DUSK|DAWN/.test(scene.timeOfDay?.toUpperCase() || "");
                const cardColor = isNight ? "#1e3a5f" : "#fef08a"; 
                const fontColor = isNight ? "#ffffff" : "#1a1a1a";

                const cardId = crypto.randomUUID();
                const unitLabel = (day as any).isSplinterUnit ? " (SPL)" : day.isSecondUnit ? " (2U)" : "";
                const cardTitle = `DAY ${day.shootDay}${unitLabel}`;

                const descParts: string[] = [];
                if (day.date) descParts.push(`DATE: ${day.date}`);
                if (day.shootTime) descParts.push(`TIME: ${day.shootTime}`);
                if (scene.description) descParts.push(scene.description);

                // Position 1: order = minOrder - newCount + index
                const cardOrder = minOrder - newCount + index;

                cardsToInsert.push({
                    id: cardId,
                    listId,
                    title: cardTitle,
                    description: descParts.join("\n"),
                    order: cardOrder,
                    color: cardColor,
                    fontColor,
                    dueDate: day.date ? parseDateString(day.date) : null,
                    isSyncedWithSheet: false,
                });

                labelsToInsert.push({
                    id: crypto.randomUUID(),
                    cardId,
                    title: scene.timeOfDay || "DAY",
                    color: isNight ? "#1e3a5f" : "#ca8a04",
                });

                if (day.isSecondUnit) {
                    labelsToInsert.push({
                        id: crypto.randomUUID(),
                        cardId,
                        title: "2ND UNIT",
                        color: "#7c3aed",
                    });
                }

                if ((day as any).isSplinterUnit) {
                    labelsToInsert.push({
                        id: crypto.randomUUID(),
                        cardId,
                        title: "SPLINTER UNIT",
                        color: "#db2777",
                    });
                }
                
                const listTitle = lists.find(l => l.id === listId)?.title || listId;
                logs.push(`Queued card (Pos 1) for Scene ${scene.sceneNum} on Day ${day.shootDay} -> List "${listTitle}"`);
            });
        }

        if (cardsToInsert.length === 0) {
            logs.push(`FAILED: No cards could be matched to existing lists.`);
            return { error: "No cards could be matched to existing lists. Check the console for details.", logs };
        }

        await db.card.createMany({ data: cardsToInsert });
        await db.label.createMany({ data: labelsToInsert });

        logs.push(`Successfully created ${cardsToInsert.length} cards and ${labelsToInsert.length} labels.`);

        revalidatePath(`/board/${boardId}`);
        return { created: cardsToInsert.length, logs };
    });

/** Try to parse a date string like "Monday, June 9th, 2026" or "June 9th, 2026" into a Date */
function parseDateString(str: string): Date | null {
    try {
        const currentYear = new Date().getFullYear();
        // Remove day-of-week prefix
        let cleaned = str.replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+/i, "").trim();
        // Remove ordinal suffixes (nd, rd, th, st)
        cleaned = cleaned.replace(/(\d+)(st|nd|rd|th)/gi, "$1");
        
        // If year is missing (no 4-digit number starting with 20), append current year
        if (!/\b(20\d{2})\b/.test(cleaned)) {
            cleaned = `${cleaned}, ${currentYear}`;
        }
        
        const d = new Date(cleaned);
        if (isNaN(d.getTime())) return null;
        
        // If the date is valid but somehow in a weird year (e.g. 2001 if someone typed '01'), 
        // and we want to assume current year:
        if (d.getFullYear() < 2000 || d.getFullYear() > 2100) {
            d.setFullYear(currentYear);
        }
        
        return d;
    } catch {
        return null;
    }
}

/** Fetch existing day cards for lists on a given board to allow auto-assignment of unmatched scenes */
export async function getExistingListDays(boardId: string): Promise<Record<string, { shootDay: string; isSecondUnit: boolean; timeOfDay: string }>> {
    const cards = await db.card.findMany({
        where: {
            list: { boardId },
            OR: [
                { title: { startsWith: "DAY " } },
                { title: { startsWith: "Day " } },
                { title: { startsWith: "day " } },
                { title: { startsWith: "DAY#" } },
                { title: { startsWith: "Day#" } },
                { title: { startsWith: "day#" } }
            ]
        },
        select: {
            listId: true,
            title: true,
            labels: {
                select: {
                    title: true
                }
            }
        }
    });

    const result: Record<string, { shootDay: string; isSecondUnit: boolean; isSplinterUnit?: boolean; timeOfDay: string }> = {};
    for (const card of cards) {
        const title = card.title.toUpperCase();
        const dayMatch = title.match(/DAY\s*#?\s*(\d+)/i);
        if (dayMatch) {
            const shootDay = dayMatch[1];
            const is2U = /\b(?:2U|2ND\s*UNIT)\b/i.test(title);
            const isSplinter = /\b(?:SPL|SPLINTER|SPLINTER\s*UNIT)\b/i.test(title);
            
            let timeOfDay = "DAY";
            if (card.labels.some((l: any) => l.title === "NIGHT") || /\bNIGHT\b/i.test(title)) {
                timeOfDay = "NIGHT";
            } else if (card.labels.some((l: any) => l.title === "DUSK") || /\bDUSK\b/i.test(title)) {
                timeOfDay = "DUSK";
            } else if (card.labels.some((l: any) => l.title === "DAWN") || /\bDAWN\b/i.test(title)) {
                timeOfDay = "DAWN";
            }
            
            result[card.listId] = {
                shootDay,
                isSecondUnit: is2U,
                isSplinterUnit: isSplinter,
                timeOfDay
            };
        }
    }
    return result;
}

/** Fetch lists for a given board directly from the server to bypass client-side state latency */
export async function getBoardLists(boardId: string): Promise<{ id: string; title: string }[]> {
    return await db.list.findMany({
        where: { boardId },
        orderBy: { order: "asc" },
        select: {
            id: true,
            title: true
        }
    });
}
