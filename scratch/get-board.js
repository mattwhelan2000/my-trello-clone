const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const boardId = "7b0a67ec-5feb-4fcc-862f-e4d6d07d0048";
  const board = await prisma.board.findUnique({
    where: { id: boardId },
  });
  console.log(JSON.stringify(board, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
