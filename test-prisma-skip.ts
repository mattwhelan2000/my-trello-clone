import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  try {
    const card = await prisma.card.findFirst();
    if (!card) return console.log("No card found");
    
    await prisma.label.createMany({
      data: [{ cardId: card.id, title: "Test Skip", color: "#000000" }],
      skipDuplicates: true
    });
    console.log("Success");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await prisma.$disconnect()
  }
}

main()
