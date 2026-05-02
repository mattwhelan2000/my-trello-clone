import { z } from "zod";

export const UpdateCardsBatchSchema = z.object({
  ids: z.array(z.string()),
  boardId: z.string(),
  rank: z.number().optional().nullable(),
  labels: z.array(z.object({
    title: z.string(),
    color: z.string(),
  })).optional(),
  dueDate: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
  delete: z.boolean().optional(),
  displayThumbnails: z.boolean().optional().nullable(),
  isSlim: z.boolean().optional().nullable(),
  addChecklist: z.boolean().optional(),
});
