import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ boardId: string }> }
) {
    try {
        const { boardId } = await params;
        const lists = await db.list.findMany({
            where: { boardId },
            select: { id: true, title: true },
            orderBy: { order: "asc" },
        });
        return NextResponse.json(lists);
    } catch (error) {
        return NextResponse.json([], { status: 500 });
    }
}
