import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Update states to add isInitial to first state
  const updatedStates = [
    { id: 0, name: "Draft", isTerminal: false, isInitial: true },
    { id: 1, name: "Pending Review", isTerminal: false, isInitial: false },
    { id: 2, name: "Approved", isTerminal: true, isInitial: false },
    { id: 3, name: "Rejected", isTerminal: true, isInitial: false }
  ];
  
  const template = await prisma.workflowTemplate.update({
    where: { id: 'template-1' },
    data: { states: updatedStates }
  });
  console.log('Updated template states:', JSON.stringify(template.states, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
