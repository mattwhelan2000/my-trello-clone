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
            className="relative h-screen bg-no-repeat bg-cover bg-center"
            style={{ backgroundImage: `url(${board.bgImage})`, backgroundColor: board.bgColor || "white" }}
        >
            <div className="absolute inset-0 bg-black/10" />
            <BoardOptions boardId={board.id} />
            <main className="relative pt-24 h-full">{children}</main>
        </div>
    );
}
