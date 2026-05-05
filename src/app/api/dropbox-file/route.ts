import { NextRequest, NextResponse } from "next/server";

async function getDropboxAccessToken(): Promise<string> {
    const appKey = process.env.DROPBOX_APP_KEY;
    const appSecret = process.env.DROPBOX_APP_SECRET;
    const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;

    if (!appKey || !appSecret || !refreshToken) {
        throw new Error("Missing Dropbox credentials");
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

// Proxies a file from Dropbox using the access token
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const path = searchParams.get("path");

    if (!path) {
        return NextResponse.json({ error: "Missing path parameter" }, { status: 400 });
    }

    let token: string;
    try {
        token = await getDropboxAccessToken();
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }

    try {
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
