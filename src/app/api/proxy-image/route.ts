import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const url = searchParams.get("url");

    if (!url) {
        return new NextResponse("Missing URL", { status: 400 });
    }

    try {
        const response = await fetch(url, {
            headers: {
                "ngrok-skip-browser-warning": "true",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });

        if (!response.ok) {
            return new NextResponse("Failed to fetch image", { status: response.status });
        }

        const buffer = await response.arrayBuffer();
        
        return new NextResponse(buffer, {
            headers: {
                "Content-Type": response.headers.get("Content-Type") || "image/png",
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch (e) {
        console.error("[PROXY IMAGE ERROR]", e);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
