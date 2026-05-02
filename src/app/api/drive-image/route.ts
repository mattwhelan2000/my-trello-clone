import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const fileId = searchParams.get("id");

    if (!fileId) {
        return new NextResponse("Missing file ID", { status: 400 });
    }

    try {
        const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        if (!serviceAccountJson) {
            throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
        }

        const credentials = JSON.parse(serviceAccountJson);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        });

        const drive = google.drive({ version: "v3", auth });

        try {
            // Try to fetch file metadata to get the mime type
            const fileMetadata = await drive.files.get({
                fileId,
                fields: "mimeType,name",
            });

            // Fetch the file content
            const response = await drive.files.get(
                { fileId, alt: "media" },
                { responseType: "stream" }
            );

            const contentType = fileMetadata.data.mimeType || "image/jpeg";
            
            return new NextResponse(response.data as any, {
                headers: {
                    "Content-Type": contentType,
                    "Cache-Control": "public, max-age=31536000, immutable",
                },
            });
        } catch (apiError: any) {
            console.warn("[DRIVE_IMAGE_PROXY] API Fetch failed, falling back to public thumbnail:", apiError.message);
            
            // If the API is disabled or permissions fail, fall back to the public thumbnail URL
            // This works if the file is shared as "Anyone with the link can view"
            const publicThumbnailUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
            return NextResponse.redirect(publicThumbnailUrl);
        }
    } catch (error: any) {
        console.error("[DRIVE_IMAGE_PROXY] Error:", error);
        return new NextResponse(`Error fetching image: ${error.message}`, { status: 500 });
    }
}
