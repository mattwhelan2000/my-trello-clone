import { NextRequest, NextResponse } from "next/server";

// Proxies a file from Dropbox using the access token
// This route is used to serve Dropbox files through our server to avoid CORS issues
// and to generate working direct download URLs
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const path = searchParams.get("path");
    const folderUrl = searchParams.get("folder");

    if (!path && !folderUrl) {
        return NextResponse.json({ error: "Missing path or folder parameter" }, { status: 400 });
    }

    const token = process.env.DROPBOX_ACCESS_TOKEN;
    if (!token) {
        return NextResponse.json({ error: "DROPBOX_ACCESS_TOKEN not configured" }, { status: 500 });
    }

    try {
        // Get a temporary download link from Dropbox
        const linkRes = await fetch("https://api.dropboxapi.com/2/files/get_temporary_link", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                path: path,
            }),
        });

        if (!linkRes.ok) {
            const err = await linkRes.text();
            console.error("[dropbox-file] Error getting temp link:", err);
            return NextResponse.json({ error: `Dropbox error: ${linkRes.status}` }, { status: 502 });
        }

        const linkData = await linkRes.json();
        const tempLink = linkData.link;

        if (!tempLink) {
            return NextResponse.json({ error: "Could not get download link" }, { status: 500 });
        }

        // Redirect to the temp link (it's a direct HTTPS download link, no auth needed)
        return NextResponse.redirect(tempLink);
    } catch (error: any) {
        console.error("[dropbox-file] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
