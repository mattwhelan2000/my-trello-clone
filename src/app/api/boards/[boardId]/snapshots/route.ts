import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ boardId: string }> }
) {
    try {
        const { boardId } = await params;

        const snapshots = await db.boardSnapshot.findMany({
            where: { boardId },
            orderBy: { createdAt: "desc" }
        });

        return NextResponse.json(snapshots);
    } catch (error) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}
