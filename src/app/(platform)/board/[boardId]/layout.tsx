import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { BoardOptions } from "@/components/board/BoardOptions";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ boardId: string }>;
}) {
    const p = await params;
    const board = await db.board.findUnique({
        where: { id: p.boardId },
    });

    return {
        title: board?.title || "Board",
    };
}

export default async function BoardIdLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ boardId: string }>;
}) {
    // We use await params in Next.js 15 for async params parsing
    const p = await params;

    const board = await db.board.findUnique({
        where: { id: p.boardId },
    });

    if (!board) {
        notFound();
    }

    return (
        <div
            className="relative h-screen"
            style={{ backgroundColor: board.bgColor || "white" }}
        >
            {board.bgImage && (
                <img
                    src={board.bgImage}
                    alt=""
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                    className="absolute inset-0 w-full h-full object-cover"
                />
            )}
            <div className="absolute inset-0 bg-black/10 z-0" />
            <div className="relative z-10 h-full">
                <BoardOptions boardId={board.id} />
                <main className="relative pt-24 h-full">{children}</main>
            </div>
        </div>
    );
}
