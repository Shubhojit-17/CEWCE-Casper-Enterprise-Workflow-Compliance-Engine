const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.workflowTemplate.findMany({
  select: { id: true, name: true, status: true, onChainWorkflowId: true }
}).then(r => {
  r.forEach(t => {
    console.log('ID:', t.id, '| Name:', t.name, '| Status:', t.status, '| OnChainID:', t.onChainWorkflowId ? t.onChainWorkflowId.toString() : 'null');
  });
}).finally(() => prisma.());
