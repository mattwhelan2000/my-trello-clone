import { db } from "@/lib/db";
import Link from "next/link";
import { CreateBoardForm } from "@/components/board/CreateBoardForm";
import { ImportBoardButton } from "@/components/board/ImportBoardButton";
import { LayoutDashboard } from "lucide-react";

export default async function HomePage() {
  const boards = await db.board.findMany({
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="pt-24 px-4 max-w-6xl mx-auto md:px-6 h-full pb-10">
      <div className="flex items-center gap-x-2 font-semibold text-lg text-neutral-700 mb-6">
        <LayoutDashboard className="h-6 w-6" />
        Your Boards
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {boards.map((board) => (
          <Link
            key={board.id}
            href={`/board/${board.id}`}
            className="group relative aspect-video bg-no-repeat bg-center bg-cover bg-blue-600 rounded-sm h-full w-full p-2 overflow-hidden transition-all hover:opacity-90 shadow-sm"
            style={{ backgroundImage: `url(${board.bgImage})`, backgroundColor: board.bgColor || "white" }}
          >
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition" />
            <p className="relative font-bold text-white shadow-sm break-words px-1 mt-1">
              {board.title}
            </p>
          </Link>
        ))}

        {/* Create Board Tile */}
        <div className="aspect-video bg-neutral-100/50 rounded-sm w-full h-full p-4 flex flex-col items-center justify-center transition border border-dashed border-neutral-300">
          <p className="text-sm font-semibold text-neutral-600 mb-3 text-center">Create a new board</p>
          <CreateBoardForm />
        </div>

        {/* Import Board Tile */}
        <div className="aspect-video bg-neutral-100/50 rounded-sm w-full h-full p-4 flex flex-col items-center justify-center transition border border-dashed border-neutral-300">
          <ImportBoardButton />
        </div>
      </div>
    </div>
  );
}
