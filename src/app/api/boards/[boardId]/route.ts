import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ boardId: string }> }
) {
    const { boardId } = await params;

    const board = await db.board.findUnique({
        where: { id: boardId },
        select: { id: true, title: true },
    });

    if (!board) {
        return new NextResponse("Board not found", { status: 404 });
    }

    return NextResponse.json(board);
}
