import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ boardId: string }> }
) {
    try {
        const { boardId } = await params;

        const labels = await db.label.findMany({
            where: {
                card: {
                    list: {
                        boardId,
                    },
                },
            },
            distinct: ['title', 'color'],
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                id: true,
                title: true,
                color: true,
            },
        });

        return NextResponse.json(labels);
    } catch (error) {
        console.error("[BOARD_LABELS_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
