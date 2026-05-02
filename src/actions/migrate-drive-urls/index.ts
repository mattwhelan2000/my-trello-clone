"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { z } from "zod";

const Schema = z.object({
    boardId: z.string(),
});

export const migrateDriveUrls = actionClient
    .schema(Schema)
    .action(async ({ parsedInput: { boardId } }) => {
        try {
            console.log(`[MigrateDriveUrls] Starting for board ${boardId}`);

            // Find all attachments for this board that have "google" or "drive" in the URL but aren't using the proxy
            const attachments = await db.attachment.findMany({
                where: {
                    card: {
                        list: {
                            boardId: boardId
                        }
                    },
                    OR: [
                        { url: { contains: "googleusercontent.com" } },
                        { url: { contains: "drive.google.com" } }
                    ],
                    NOT: {
                        url: { contains: "/api/drive-image" }
                    }
                }
            });

            console.log(`[MigrateDriveUrls] Found ${attachments.length} attachments to migrate`);

            let migratedCount = 0;

            for (const attachment of attachments) {
                // Try to extract the file ID from the URL
                // Common formats:
                // 1. thumbnailLink: https://lh3.googleusercontent.com/drive-storage/AJQ...=s1000
                // 2. direct link: https://drive.google.com/thumbnail?id=FILE_ID&sz=w1000
                
                let fileId: string | null = null;

                const urlParams = new URLSearchParams(attachment.url.split("?")[1]);
                fileId = urlParams.get("id");

                if (!fileId) {
                    // If no ID in params, it might be a drive-storage URL which doesn't have the ID directly
                    // In that case, we might be stuck UNLESS we have the ID somewhere else.
                    // WAIT! In bulk-ingest-images, we didn't store the fileId separately.
                    // But maybe we can find it?
                    
                    // Let's check the cards to see if the ID is in the description or somewhere? No.
                    
                    // IF WE CAN'T EXTRACT THE ID, WE MIGHT NEED TO RE-INGEST.
                    // But wait! Many drive-storage URLs are just the content.
                }

                if (fileId) {
                    await db.attachment.update({
                        where: { id: attachment.id },
                        data: {
                            url: `/api/drive-image?id=${fileId}`
                        }
                    });
                    migratedCount++;
                }
            }

            revalidatePath(`/board/${boardId}`);
            return { count: migratedCount, totalFound: attachments.length };
        } catch (error: any) {
            console.error("[MigrateDriveUrls] Error:", error);
            return { error: error.message || "Failed to migrate URLs" };
        }
    });
