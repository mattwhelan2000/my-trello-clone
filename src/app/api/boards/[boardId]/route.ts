import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ boardId: string }> }
) {
    try {
        const { boardId } = await params;

        const board = await db.board.findUnique({
            where: { id: boardId },
            select: { id: true, title: true },
        });

        if (!board) {
            return new NextResponse("Board not found", { status: 404 });
        }

        return NextResponse.json(board);
    } catch (error: any) {
        console.error("Board API error:", error);
        return NextResponse.json(
            { error: error.message, code: error.code, meta: error.meta },
            { status: 500 }
        );
    }
}
