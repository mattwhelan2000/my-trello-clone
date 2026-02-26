"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateBoardSchema } from "./schema";

export const createBoard = actionClient
    .schema(CreateBoardSchema)
    .action(async ({ parsedInput: { title } }) => {
        try {
            // Check if there is a workspace, otherwise create a default one
            let workspace = await db.workspace.findFirst();

            if (!workspace) {
                workspace = await db.workspace.create({
                    data: {
                        name: "My Workspace",
                        members: ["default_user"],
                    }
                });
            }

            const board = await db.board.create({
                data: {
                    title,
                    workspaceId: workspace.id,
                    bgColor: "#3b82f6", // Default blue color
                },
            });

            // Redirects should ideally be handled by the client after a successful action,
            // but for simplicity we return the board object here and revalidate the home page.
            revalidatePath("/");

            return board;
        } catch (error) {
            return { error: "Failed to create board." };
        }
    });
