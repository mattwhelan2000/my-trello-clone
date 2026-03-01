const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
db.checklistItem.findMany().then(items => {
    console.log("Checklist Items:", items);
    db.$disconnect();
});
db.card.findMany().then(cards => {
    console.log("Cards with color:", cards.map(c => ({ id: c.id, title: c.title, color: c.color })));
    db.$disconnect();
});
