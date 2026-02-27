import { db } from "@/lib/db";
import Link from "next/link";
import { CreateBoardForm } from "@/components/board/CreateBoardForm";
import { ImportBoardButton } from "@/components/board/ImportBoardButton";
import { DashboardBoardItem } from "@/components/board/DashboardBoardItem";
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
          <DashboardBoardItem key={board.id} board={board} />
        ))}

        {/* Create Board Tile */}
        <div className="h-64 bg-neutral-100/50 rounded-sm w-full p-4 flex flex-col items-center justify-center transition border border-dashed border-neutral-300">
          <p className="text-sm font-semibold text-neutral-600 mb-3 text-center">Create a new board</p>
          <CreateBoardForm />
        </div>

        {/* Import Board Tile */}
        <div className="h-64 bg-neutral-100/50 rounded-sm w-full p-4 flex flex-col items-center justify-center transition border border-dashed border-neutral-300">
          <ImportBoardButton />
        </div>
      </div>
    </div>
  );
}
