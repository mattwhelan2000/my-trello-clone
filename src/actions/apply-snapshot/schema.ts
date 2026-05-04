import { z } from "zod";

export const ApplySnapshotSchema = z.object({
    boardId: z.string(),
    snapshotId: z.string(),
});
