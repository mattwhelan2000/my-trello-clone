const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function check() {
    const boardId = process.argv[2];
    if (!boardId) {
        console.log("Please provide a boardId");
        return;
    }

    const lists = await db.list.findMany({
        where: { boardId },
        include: {
            cards: {
                orderBy: { order: "asc" }
            }
        }
    });

    for (const list of lists) {
        console.log(`List: ${list.title} (${list.id})`);
        list.cards.forEach(card => {
            console.log(`  - [${card.order}] ${card.title} (${card.id})`);
        });
    }
}

check();
