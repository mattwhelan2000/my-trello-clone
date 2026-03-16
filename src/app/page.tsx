import { db } from "@/lib/db";
import Link from "next/link";
import { CreateBoardForm } from "@/components/board/CreateBoardForm";
import { ImportBoardButton } from "@/components/board/ImportBoardButton";
import { ImportScriptButton } from "@/components/board/ImportScriptButton";
import { DashboardBoardItem } from "@/components/board/DashboardBoardItem";
import { LayoutDashboard } from "lucide-react";

export default async function HomePage() {
  const boards = await db.board.findMany({
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="pt-24 px-4 max-w-6xl mx-auto md:px-6 min-h-full pb-10 bg-neutral-900 text-white">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-y-4 mb-8">
        <div className="flex items-center gap-x-2 font-semibold text-xl text-neutral-200">
          <LayoutDashboard className="h-7 w-7 text-blue-500" />
          Your Boards
          <span className="text-xs font-mono text-neutral-500 ml-2 bg-neutral-800 px-2 py-0.5 rounded-sm">0316.11:47</span>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-40 sm:w-48 shadow-sm">
            <CreateBoardForm />
          </div>
          <div className="w-40 sm:w-48 shadow-sm">
            <ImportBoardButton />
          </div>
          <div className="w-40 sm:w-48 lg:w-56 shadow-sm">
            <ImportScriptButton />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {boards.map((board) => (
          <DashboardBoardItem key={board.id} board={board} />
        ))}
      </div>
    </div>
  );
}
