"use server";

import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateOneLineCardsSchema } from "./schema";
import { revalidatePath } from "next/cache";

// Fuzzy match: returns the list ID whose title best matches the scene number
function fuzzyMatchList(sceneNum: string, lists: { id: string; title: string }[]): string | null {
    if (!sceneNum || sceneNum === "?") return null;

    const num = sceneNum.replace(/\D/g, "").padStart(3, "0");
    const numInt = parseInt(sceneNum.replace(/\D/g, ""), 10);

    // 1. Exact padded match — e.g. "Sc001"
    let match = lists.find(l => {
        const t = l.title.toUpperCase();
        return t.includes(`SC${num}`) || t.includes(`SC${numInt}`) || t.startsWith(`SC${num}`) || t.startsWith(`SC${numInt}`);
    });
    if (match) return match.id;

    // 2. Contains the number anywhere
    match = lists.find(l => {
        const t = l.title.toUpperCase();
        const re = new RegExp(`\\b0*${numInt}\\b`);
        return re.test(t);
    });
    if (match) return match.id;

    return null;
}

export const createOneLineCards = actionClient
    .schema(CreateOneLineCardsSchema)
    .action(async ({ parsedInput: { boardId, days, lists, deleteExistingDayCards, splitListsForMultiDayScenes } }) => {
        const cardsToInsert: any[] = [];
        const labelsToInsert: any[] = [];

        // 1. Delete existing DAY cards if requested
        if (deleteExistingDayCards) {
            await db.card.deleteMany({
                where: {
                    list: { boardId },
                    labels: { some: { title: "DAY" } }
                }
            });
        }

        // 2. Pre-calculate list splits for multi-day scenes
        const listDayUsage: Record<string, string[]> = {}; // listId -> unique day labels
        for (const day of days) {
            for (const scene of day.scenes) {
                if (scene.isOmitted) continue;
                const lid = scene.listId || fuzzyMatchList(scene.sceneNum, lists);
                if (!lid) continue;
                if (!listDayUsage[lid]) listDayUsage[lid] = [];
                const dayLabel = `${day.shootDay}${day.isSecondUnit ? "2U" : ""}`;
                if (!listDayUsage[lid].includes(dayLabel)) {
                    listDayUsage[lid].push(dayLabel);
                }
            }
        }

        const listIdOverrides: Record<string, string> = {}; // "listId-dayLabel" -> targetListId
        if (splitListsForMultiDayScenes) {
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
                    if (!originalList) continue;
                    
                    const originalTitle = originalList.title;
                    const N = dayLabels.length;

                    // Update original list title
                    await db.list.update({
                        where: { id: lid },
                        data: { title: `${originalTitle} Pt.1/${N}` }
                    });
                    listIdOverrides[`${lid}-${dayLabels[0]}`] = lid;

                    // Create N-1 copies
                    for (let i = 1; i < N; i++) {
                        const newList = await db.list.create({
                            data: {
                                boardId,
                                title: `${originalTitle} Pt.${i+1}/${N}`,
                                order: originalList.order + (i * 0.001), // Keep them adjacent
                            }
                        });
                        listIdOverrides[`${lid}-${dayLabels[i]}`] = newList.id;

                        // Clone cards if requested
                        if (cloneCardsInSplitLists && originalList.cards.length > 0) {
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
                                                order: c.order,
                                                items: {
                                                    create: c.items.map(item => ({
                                                        title: item.title,
                                                        order: item.order,
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

        // Pre-fetch existing card orders per list so we append
        const targetListIds = new Set<string>();
        for (const day of days) {
            for (const scene of day.scenes) {
                const lid = scene.listId || fuzzyMatchList(scene.sceneNum, lists);
                if (lid) targetListIds.add(lid);
            }
        }
        // Also add any new lists created from overrides
        Object.values(listIdOverrides).forEach(id => targetListIds.add(id));

        const existingCards = await db.card.findMany({
            where: { listId: { in: Array.from(targetListIds) } },
            select: { listId: true, order: true },
            orderBy: { order: "desc" },
        });

        const listMaxOrder: Record<string, number> = {};
        for (const card of existingCards) {
            if (listMaxOrder[card.listId] === undefined || card.order > listMaxOrder[card.listId]) {
                listMaxOrder[card.listId] = card.order;
            }
        }
        const listCounters: Record<string, number> = {};
        const getNextOrder = (listId: string) => {
            if (listCounters[listId] === undefined) {
                listCounters[listId] = (listMaxOrder[listId] ?? -1) + 1;
            } else {
                listCounters[listId]++;
            }
            return listCounters[listId];
        };

        for (const day of days) {
            for (const scene of day.scenes) {
                if (scene.isOmitted) continue;

                const baseListId = scene.listId || fuzzyMatchList(scene.sceneNum, lists);
                if (!baseListId) continue; 

                // Resolve list ID with potential overrides (multi-day split)
                const dayLabel = `${day.shootDay}${day.isSecondUnit ? "2U" : ""}`;
                const listId = listIdOverrides[`${baseListId}-${dayLabel}`] || baseListId;

                const isNight = /NIGHT|DUSK|DAWN/.test(scene.timeOfDay.toUpperCase());
                const cardColor = isNight ? "#1e3a5f" : "#fef08a"; 
                const fontColor = isNight ? "#ffffff" : "#1a1a1a";

                const cardId = crypto.randomUUID();
                const unitLabel = day.isSecondUnit ? " (2U)" : "";
                const cardTitle = `DAY ${day.shootDay}${unitLabel}`;

                // Description: ensure date is included as text
                const descParts: string[] = [];
                if (day.date) descParts.push(`DATE: ${day.date}`);
                if (day.shootTime) descParts.push(`TIME: ${day.shootTime}`);
                if (scene.description) descParts.push(scene.description);

                cardsToInsert.push({
                    id: cardId,
                    listId,
                    title: cardTitle,
                    description: descParts.join("\n"),
                    order: getNextOrder(listId),
                    color: cardColor,
                    fontColor,
                    dueDate: day.date ? parseDateString(day.date) : null,
                    isSyncedWithSheet: false,
                });

                // Label: DAY or NIGHT
                labelsToInsert.push({
                    id: crypto.randomUUID(),
                    cardId,
                    title: scene.timeOfDay || "DAY",
                    color: isNight ? "#1e3a5f" : "#ca8a04",
                });

                // 2nd unit label
                if (day.isSecondUnit) {
                    labelsToInsert.push({
                        id: crypto.randomUUID(),
                        cardId,
                        title: "2ND UNIT",
                        color: "#7c3aed",
                    });
                }
            }
        }

        if (cardsToInsert.length === 0) {
            throw new Error("No cards could be matched to existing lists. Ensure scene numbers match list titles.");
        }

        await db.card.createMany({ data: cardsToInsert });
        await db.label.createMany({ data: labelsToInsert });

        revalidatePath(`/board/${boardId}`);
        return { created: cardsToInsert.length };
    });

/** Try to parse a date string like "Monday, June 9th, 2026" or "June 9th, 2026" into a Date */
function parseDateString(str: string): Date | null {
    try {
        // Remove day-of-week prefix
        let cleaned = str.replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+/i, "").trim();
        // Remove ordinal suffixes (nd, rd, th, st)
        cleaned = cleaned.replace(/(\d+)(st|nd|rd|th)/gi, "$1");
        
        const d = new Date(cleaned);
        if (isNaN(d.getTime())) return null;
        return d;
    } catch {
        return null;
    }
}
