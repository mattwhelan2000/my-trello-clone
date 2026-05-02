import { db } from "@/lib/db";
import dynamic from "next/dynamic";

const BoardCanvas = dynamic(() => import("@/components/board/BoardCanvas").then((mod) => mod.BoardCanvas), { ssr: false });
const ListContainer = dynamic(() => import("@/components/board/ListContainer").then((mod) => mod.ListContainer), { ssr: false });

export default async function BoardIdPage({
    params,
}: {
    params: Promise<{ boardId: string }>;
}) {
    const p = await params;

    const board = await db.board.findUnique({
        where: { id: p.boardId },
        select: {
            listColorSwatches: true,
            textColorSwatches: true,
        }
    });

    // We fetch lists and their cards here so we can pass initial data to our client-side dnd context
    const lists = await db.list.findMany({
        where: {
            boardId: p.boardId,
        },
        include: {
            cards: {
                orderBy: {
                    order: "asc",
                },
                include: {
                    attachments: true,
                    labels: true,
                    activities: {
                        orderBy: { createdAt: "desc" }
                    },
                    checklists: {
                        include: {
                            items: {
                                orderBy: { createdAt: "asc" }
                            }
                        }
                    }
                }
            },
        },
        orderBy: {
            order: "asc",
        },
    });

    return (
        <div className="p-4 h-full">
            <BoardCanvas boardId={p.boardId}>
                <ListContainer 
                    boardId={p.boardId} 
                    data={lists} 
                    listColorSwatches={board?.listColorSwatches}
                    textColorSwatches={board?.textColorSwatches}
                />
            </BoardCanvas>
        </div>
    );
}
