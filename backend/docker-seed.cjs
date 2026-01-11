const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

// Match the auth.ts password hashing exactly
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function seed() {
  const prisma = new PrismaClient();
  
  console.log('Seeding database...');
  
  // Create organization
  const org = await prisma.organization.create({
    data: {
      id: 'org-1',
      name: 'Demo Corp',
      slug: 'demo-corp'
    }
  });
  console.log('Created org:', org.id);
  
  // Create roles
  const roles = await Promise.all([
    prisma.role.create({ data: { id: 'role-requester', name: 'REQUESTER', bitmask: 1, isSystem: true, permissions: [] }}),
    prisma.role.create({ data: { id: 'role-approver', name: 'APPROVER', bitmask: 2, isSystem: true, permissions: [] }}),
    prisma.role.create({ data: { id: 'role-senior', name: 'SENIOR_APPROVER', bitmask: 4, isSystem: true, permissions: [] }}),
    prisma.role.create({ data: { id: 'role-admin', name: 'ADMIN', bitmask: 8, isSystem: true, permissions: [] }}),
    prisma.role.create({ data: { id: 'role-auditor', name: 'AUDITOR', bitmask: 16, isSystem: true, permissions: [] }})
  ]);
  console.log('Created roles:', roles.length);
  
  // Create admin user with CORRECT password hash format
  const hash = hashPassword('admin123');
  const user = await prisma.user.create({
    data: {
      id: 'user-admin',
      email: 'admin@demo.com',
      passwordHash: hash,
      displayName: 'Admin User',
      publicKey: '02020e45c61d00b16ab0c0d48d8be564a65ac1a3b7e3ec25ba30aa093f6b4c1e8181',
      isActive: true
    }
  });
  console.log('Created user:', user.id);
  
  // Assign all roles
  for (const role of roles) {
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id }
    });
  }
  console.log('Assigned roles');
  
  // Create workflow template - DRAFT status, NO onChainWorkflowId
  // Template must be PUBLISHED and registered on-chain to get real workflow ID
  const template = await prisma.workflowTemplate.create({
    data: {
      id: 'template-1',
      orgId: org.id,
      name: 'Approval Workflow',
      status: 'DRAFT',  // Must be published to register on-chain
      // NO onChainWorkflowId - must come from real Casper deploy
      states: [
        { id: 0, name: 'Draft', isTerminal: false },
        { id: 1, name: 'Pending Review', isTerminal: false },
        { id: 2, name: 'Approved', isTerminal: true },
        { id: 3, name: 'Rejected', isTerminal: true }
      ],
      transitions: [
        { fromState: 0, toState: 1, name: 'Submit', requiredRoles: ['REQUESTER', 'ADMIN'] },
        { fromState: 1, toState: 2, name: 'Approve', requiredRoles: ['APPROVER', 'ADMIN'] },
        { fromState: 1, toState: 3, name: 'Reject', requiredRoles: ['APPROVER', 'ADMIN'] },
        { fromState: 1, toState: 0, name: 'Request Changes', requiredRoles: ['APPROVER'] }
      ]
    }
  });
  console.log('Created template:', template.id, '(DRAFT - must publish to register on-chain)');
  
  // NO workflow instance yet - cannot create until template is registered on-chain
  
  await prisma.$disconnect();
  console.log('Seed complete!');
}

seed().catch(e => { console.error(e); process.exit(1); });
