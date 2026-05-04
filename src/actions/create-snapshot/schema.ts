import { z } from "zod";

export const CreateSnapshotSchema = z.object({
    boardId: z.string(),
    title: z.string().min(1, "Title is required"),
});
