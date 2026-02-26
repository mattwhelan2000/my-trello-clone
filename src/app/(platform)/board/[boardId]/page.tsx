import { db } from "@/lib/db";
import { BoardCanvas } from "@/components/board/BoardCanvas";
import { ListContainer } from "@/components/board/ListContainer";

export default async function BoardIdPage({
    params,
}: {
    params: Promise<{ boardId: string }>;
}) {
    const p = await params;

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
                <ListContainer boardId={p.boardId} data={lists} />
            </BoardCanvas>
        </div>
    );
}
