import { z } from "zod";

export const OneLineSceneSchema = z.object({
    sceneNum: z.string(),
    intExt: z.string(),
    location: z.string(),
    timeOfDay: z.string(),
    description: z.string(),
    listId: z.string().optional(),
    isOmitted: z.boolean().optional(),
});

export const OneLineDaySchema = z.object({
    shootDay: z.string(),
    isSecondUnit: z.boolean(),
    isSplinterUnit: z.boolean().optional(),
    date: z.string(),
    shootTime: z.string().optional(),
    scenes: z.array(OneLineSceneSchema),
});

export const CreateOneLineCardsSchema = z.object({
    boardId: z.string(),
    days: z.array(OneLineDaySchema),
    lists: z.array(z.object({
        id: z.string(),
        title: z.string(),
    })),
    deleteExistingDayCards: z.boolean().optional(),
    splitListsForMultiDayScenes: z.boolean().optional(),
    cloneCardsInSplitLists: z.boolean().optional(),
});
