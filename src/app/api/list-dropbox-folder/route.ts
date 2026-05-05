import { NextRequest, NextResponse } from "next/server";

async function getDropboxAccessToken(): Promise<string> {
    const appKey = process.env.DROPBOX_APP_KEY;
    const appSecret = process.env.DROPBOX_APP_SECRET;
    const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;

    if (!appKey || !appSecret || !refreshToken) {
        throw new Error("Missing Dropbox credentials (DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN)");
    }

    const credentials = Buffer.from(`${appKey}:${appSecret}`).toString("base64");
    const res = await fetch("https://api.dropbox.com/oauth2/token", {
        method: "POST",
        headers: {
            "Authorization": `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to refresh Dropbox token: ${err}`);
    }

    const data = await res.json();
    return data.access_token as string;
}

// Converts a Dropbox shared folder URL into a listable path using the Dropbox API
// Works with the shared link format: https://www.dropbox.com/scl/fo/...
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const folderUrl = searchParams.get("url");

    if (!folderUrl) {
        return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    let token: string;
    try {
        token = await getDropboxAccessToken();
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }


    try {
        // Step 1: Resolve the shared link to get metadata about the folder
        const metaRes = await fetch("https://api.dropboxapi.com/2/sharing/get_shared_link_metadata", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: folderUrl }),
        });

        if (!metaRes.ok) {
            const err = await metaRes.text();
            console.error("[list-dropbox-folder] Metadata error:", err);
            return NextResponse.json({ error: `Dropbox API error: ${metaRes.status}` }, { status: 502 });
        }

        // Step 2: List contents of the shared folder
        const listRes = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                path: "",
                shared_link: { url: folderUrl },
                recursive: false,
                include_media_info: false,
                include_deleted: false,
                include_has_explicit_shared_members: false,
            }),
        });

        if (!listRes.ok) {
            const err = await listRes.text();
            console.error("[list-dropbox-folder] List error:", err);
            return NextResponse.json({ error: `Dropbox list error: ${listRes.status}` }, { status: 502 });
        }

        const listData = await listRes.json();
        const entries = listData.entries || [];

        // Step 3: Map to our unified file format
        const files = entries
            .filter((e: any) => e[".tag"] === "file")
            .map((e: any) => {
                // Build a direct download URL for the file
                const directUrl = `https://www.dropbox.com/scl/fi/placeholder?rlkey=placeholder&dl=1`;
                // We use the Dropbox temp link approach — get_temporary_link per file would require auth
                // Instead we store the path_lower and resolve it in the ingest action
                return {
                    name: e.name,
                    path: e.path_lower,
                    id: e.id,
                    size: e.size,
                    // Generate a shareable direct download URL using dl=1
                    url: `/api/dropbox-file?path=${encodeURIComponent(e.path_lower)}&folder=${encodeURIComponent(folderUrl)}`,
                    mimeType: getMimeFromName(e.name),
                };
            });

        return NextResponse.json({ files });
    } catch (error: any) {
        console.error("[list-dropbox-folder] Error:", error);
        return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
    }
}

function getMimeFromName(name: string): string {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    const map: Record<string, string> = {
        pdf: "application/pdf",
        mp3: "audio/mpeg",
        mp4: "video/mp4",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        mov: "video/quicktime",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        json: "application/json",
    };
    return map[ext] || "application/octet-stream";
}
