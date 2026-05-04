import { z } from "zod";

export const DeleteSnapshotSchema = z.object({
    boardId: z.string(),
    snapshotId: z.string(),
});
