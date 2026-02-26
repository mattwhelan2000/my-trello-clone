import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database with initial data...')

  // Create Workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Default Workspace',
      members: ['user_mock_123']
    }
  })
  console.log('Created Workspace:', workspace.id)

  // Create Board
  const board = await prisma.board.create({
    data: {
      workspaceId: workspace.id,
      title: 'Trello Clone Project',
      bgImage: 'https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=2832&auto=format&fit=crop', // Nice abstract gradient
      bgColor: '#3b82f6',
    }
  })
  console.log('Created Board:', board.id)

  // Create Lists
  const list1 = await prisma.list.create({
    data: { boardId: board.id, title: 'To Do', order: 1 }
  })
  const list2 = await prisma.list.create({
    data: { boardId: board.id, title: 'In Progress', order: 2 }
  })
  const list3 = await prisma.list.create({
    data: { boardId: board.id, title: 'Done', order: 3 }
  })
  console.log('Created Lists')

  // Create Cards
  const c1 = await prisma.card.create({
    data: { listId: list1.id, title: 'Initialize Next.js App', description: 'Setup the base repository.', order: 1 }
  })
  const c2 = await prisma.card.create({
    data: { listId: list1.id, title: 'Configure Prisma', description: 'Define the schema to support Boards, Lists, and Cards.', order: 2 }
  })

  const c3 = await prisma.card.create({
    data: { listId: list2.id, title: 'Drag and Drop Components', description: 'Implement horizontal and vertical list/card dragging.', order: 1 }
  })

  console.log('Created Cards')

  // Label for a card
  await prisma.label.create({
    data: { cardId: c1.id, title: 'React', color: 'blue' }
  })

  // Checklist for a card
  const checklist = await prisma.checklist.create({
    data: { cardId: c1.id, title: 'Tasks' }
  })
  await prisma.checklistItem.create({
    data: { checklistId: checklist.id, title: 'Setup tsconfig', isCompleted: true }
  })

  console.log('Seeding finished.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
