import { z } from "zod";

export const OneLineSceneSchema = z.object({
    sceneNum: z.string(),
    intExt: z.string(),
    location: z.string(),
    timeOfDay: z.string(),
    description: z.string(),
});

export const OneLineDaySchema = z.object({
    shootDay: z.string(),
    isSecondUnit: z.boolean(),
    date: z.string(),
    scenes: z.array(OneLineSceneSchema),
});

export const CreateOneLineCardsSchema = z.object({
    boardId: z.string(),
    days: z.array(OneLineDaySchema),
    lists: z.array(z.object({
        id: z.string(),
        title: z.string(),
    })),
});
