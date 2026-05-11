import { z } from "zod";

export const SortListsSchema = z.object({
    boardId: z.string(),
    order: z.enum(["asc", "desc"]),
});
