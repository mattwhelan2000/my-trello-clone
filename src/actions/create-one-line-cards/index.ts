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
    .action(async ({ parsedInput: { boardId, days, lists } }) => {
        const cardsToInsert: any[] = [];
        const labelsToInsert: any[] = [];

        // Pre-fetch existing card orders per list so we append
        const listIds = new Set(days.flatMap(d => d.scenes.map(s => fuzzyMatchList(s.sceneNum, lists))).filter(Boolean) as string[]);
        const existingCards = await db.card.findMany({
            where: { listId: { in: Array.from(listIds) } },
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

                const listId = scene.listId || fuzzyMatchList(scene.sceneNum, lists);
                if (!listId) continue; // No matching list found — skip

                const isNight = /NIGHT|DUSK|DAWN/.test(scene.timeOfDay.toUpperCase());
                const cardColor = isNight ? "#1e3a5f" : "#fef08a"; // dark blue or yellow
                const fontColor = isNight ? "#ffffff" : "#1a1a1a";

                const cardId = crypto.randomUUID();
                const unitLabel = day.isSecondUnit ? " (2U)" : "";
                const cardTitle = `DAY ${day.shootDay}${unitLabel}`;

                // Description: date + shoot time + scene description
                const descParts: string[] = [];
                if (day.date) descParts.push(day.date);
                if (day.shootTime) descParts.push(day.shootTime);
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

/** Try to parse a date string like "Monday, June 9, 2026" or "June 9, 2026" into a Date */
function parseDateString(str: string): Date | null {
    try {
        // Remove day-of-week prefix
        const cleaned = str.replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*,?\s+/i, "").trim();
        const d = new Date(cleaned);
        if (isNaN(d.getTime())) return null;
        return d;
    } catch {
        return null;
    }
}
