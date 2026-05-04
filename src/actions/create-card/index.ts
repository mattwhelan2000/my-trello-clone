"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { actionClient } from "@/lib/create-safe-action";
import { CreateCardSchema } from "./schema";
import { formatImageUrl } from "@/lib/format-image-url";

/**
 * Checks if a string is a valid URL
 */
function isValidUrl(str: string): boolean {
    try {
        new URL(str.trim());
        return true;
    } catch {
        return false;
    }
}

/**
 * Extracts YouTube video ID from various YouTube URL formats
 */
function getYoutubeVideoId(url: string): string | null {
    try {
        const urlObj = new URL(url);
        // youtube.com/watch?v=VIDEO_ID
        if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.get('v')) {
            return urlObj.searchParams.get('v');
        }
        // youtu.be/VIDEO_ID
        if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.slice(1).split('/')[0];
        }
        // youtube.com/embed/VIDEO_ID
        if (urlObj.hostname.includes('youtube.com') && urlObj.pathname.startsWith('/embed/')) {
            return urlObj.pathname.split('/')[2];
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Converts Dropbox share links to direct download links
 */
function getDropboxDirectUrl(url: string): string {
    return formatImageUrl(url) || url;
}

/**
 * Determines attachment type and thumbnail for a URL
 */
function getUrlAttachmentInfo(url: string): {
    type: string;
    thumbnailUrl: string | null;
    title: string;
    url: string;
    isDropbox: boolean;
} {
    const trimmedUrl = url.trim();

    // YouTube
    const ytId = getYoutubeVideoId(trimmedUrl);
    if (ytId) {
        return {
            type: 'LINK',
            thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
            title: `YouTube Video`,
            url: trimmedUrl,
            isDropbox: false,
        };
    }

    // Check if it's a Dropbox link
    const isDropbox = trimmedUrl.includes('dropbox.com');
    const directUrl = isDropbox ? getDropboxDirectUrl(trimmedUrl) : trimmedUrl;

    // Check file extension from the URL path
    let ext = '';
    try {
        const urlObj = new URL(trimmedUrl);
        const pathname = urlObj.pathname;
        const lastDot = pathname.lastIndexOf('.');
        if (lastDot !== -1) {
            ext = pathname.substring(lastDot + 1).toLowerCase();
        }
    } catch { }

    // Image extensions
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'tiff'];
    if (imageExts.includes(ext)) {
        return {
            type: 'IMAGE',
            thumbnailUrl: directUrl,
            title: trimmedUrl.split('/').pop()?.split('?')[0] || 'Image',
            url: directUrl,
            isDropbox,
        };
    }

    // Video extensions
    const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
    if (videoExts.includes(ext)) {
        return {
            type: 'LINK',
            thumbnailUrl: null,
            title: trimmedUrl.split('/').pop()?.split('?')[0] || 'Video',
            url: directUrl,
            isDropbox,
        };
    }

    // Audio extensions
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'];
    if (audioExts.includes(ext)) {
        return {
            type: 'LINK',
            thumbnailUrl: null,
            title: trimmedUrl.split('/').pop()?.split('?')[0] || 'Audio',
            url: directUrl,
            isDropbox,
        };
    }

    // PDF
    if (ext === 'pdf') {
        return {
            type: 'LINK',
            thumbnailUrl: null,
            title: trimmedUrl.split('/').pop()?.split('?')[0] || 'PDF Document',
            url: directUrl,
            isDropbox,
        };
    }

    // Office docs
    const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'odt', 'ods', 'odp'];
    if (officeExts.includes(ext)) {
        return {
            type: 'LINK',
            thumbnailUrl: null,
            title: trimmedUrl.split('/').pop()?.split('?')[0] || 'Document',
            url: directUrl,
            isDropbox,
        };
    }

    // Dropbox with no recognized extension - still convert to direct
    if (isDropbox) {
        return {
            type: 'LINK',
            thumbnailUrl: null,
            title: trimmedUrl.split('/').pop()?.split('?')[0] || 'Dropbox File',
            url: directUrl,
            isDropbox: true,
        };
    }

    // Generic link
    return {
        type: 'LINK',
        thumbnailUrl: null,
        title: trimmedUrl,
        url: trimmedUrl,
        isDropbox: false,
    };
}

export const createCard = actionClient
    .schema(CreateCardSchema)
    .action(async ({ parsedInput: { title, boardId, listId, imageUrl, iframeUrl } }) => {
        try {
            const list = await db.list.findUnique({
                where: { id: listId, boardId },
            });

            if (!list) {
                throw new Error("List not found");
            }

            const lastCard = await db.card.findFirst({
                where: { listId },
                orderBy: { order: "desc" },
                select: { order: true },
            });

            const newOrder = lastCard ? lastCard.order + 1 : 0;

            const cardData: any = {
                title,
                listId,
                order: newOrder,
            };

            // If an explicit iframeUrl was provided, handle it
            if (iframeUrl) {
                cardData.attachments = {
                    create: {
                        url: iframeUrl,
                        type: "IFRAME",
                        title: "Embed",
                        isCover: true,
                    }
                };
            }
            // If an explicit imageUrl was provided (paste flow), handle it as before
            else if (imageUrl) {
                const isImage = imageUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) || imageUrl.includes("dropbox.com");
                const type = isImage ? "IMAGE" : "LINK";
                let fetchedTitle = imageUrl;
                let thumbnailUrl = null;

                if (type === "LINK") {
                    try {
                        const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(imageUrl)}`);
                        if (res.ok) {
                            const data = await res.json();
                            fetchedTitle = data.data?.title || fetchedTitle;
                            thumbnailUrl = data.data?.image?.url || null;
                            cardData.title = fetchedTitle;
                        }
                    } catch (e) {
                        console.error("Failed to fetch link metadata", e);
                    }
                }

                cardData.attachments = {
                    create: {
                        url: imageUrl,
                        type,
                        title: fetchedTitle,
                        thumbnailUrl,
                    }
                };
            }
            // Auto-detect: if the title itself is a URL, auto-import as attachment
            else if (isValidUrl(title.trim())) {
                const info = getUrlAttachmentInfo(title.trim());

                // For YouTube, fetch the real video title via microlink
                if (getYoutubeVideoId(title.trim())) {
                    try {
                        const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(title.trim())}`);
                        if (res.ok) {
                            const data = await res.json();
                            if (data.data?.title) {
                                info.title = data.data.title;
                            }
                        }
                    } catch (e) {
                        console.error("Failed to fetch YouTube metadata", e);
                    }
                }

                // Keep the URL as the card title (it's a clickable link in the UI)
                cardData.title = title.trim();

                cardData.attachments = {
                    create: {
                        url: info.url,
                        type: info.type,
                        title: info.title,
                        thumbnailUrl: info.thumbnailUrl,
                    }
                };
            }

            const card = await db.card.create({
                data: cardData,
            });

            revalidatePath(`/board/${boardId}`);
            return card;
        } catch (error) {
            throw new Error("Failed to create card.");
        }
    });
