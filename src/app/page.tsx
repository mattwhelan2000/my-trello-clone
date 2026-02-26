import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function HomePage() {
  const board = await db.board.findFirst();

  if (board) {
    redirect(`/board/${board.id}`);
  }

  // If no boards exist, we could show a create board page, but for this clone we'll just show a message.
  return (
    <div className="h-full flex items-center justify-center bg-white text-black p-4">
      <div className="text-center">
        <h1 className="text-3xl font-semibold mb-4">Welcome to Trello Clone</h1>
        <p className="text-neutral-600 mb-6">No boards found. Please wait for the database seed or create one.</p>
      </div>
    </div>
  );
}
