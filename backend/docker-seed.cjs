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
  
  // Create organization (upsert for idempotency)
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-corp' },
    update: {},
    create: {
      id: 'org-1',
      name: 'Demo Corp',
      slug: 'demo-corp'
    }
  });
  console.log('Organization ready:', org.id);
  
  // Create roles (upsert for idempotency)
  const roleData = [
    { id: 'role-user', name: 'USER', description: 'Basic user access', bitmask: 1, isSystem: true, permissions: ['workflow:read', 'workflow:create'] },
    { id: 'role-requester', name: 'REQUESTER', description: 'Can create workflow instances', bitmask: 1, isSystem: true, permissions: ['workflow:create', 'workflow:read'] },
    { id: 'role-approver', name: 'APPROVER', description: 'Can approve/reject workflows', bitmask: 2, isSystem: true, permissions: ['workflow:approve', 'workflow:reject', 'workflow:read'] },
    { id: 'role-senior', name: 'SENIOR_APPROVER', description: 'Can approve escalated workflows', bitmask: 4, isSystem: true, permissions: ['workflow:approve', 'workflow:reject', 'workflow:read'] },
    { id: 'role-admin', name: 'ADMIN', description: 'Full system administrator', bitmask: 8, isSystem: true, permissions: ['*'] },
    { id: 'role-auditor', name: 'AUDITOR', description: 'View audit logs and compliance', bitmask: 16, isSystem: true, permissions: ['audit:read', 'audit:export', 'workflow:read'] },
    { id: 'role-viewer', name: 'VIEWER', description: 'View-only access', bitmask: 32, isSystem: true, permissions: ['workflow:read'] },
    { id: 'role-customer', name: 'CUSTOMER', description: 'External customer access', bitmask: 128, isSystem: true, permissions: ['workflow:read', 'document:upload'] },
    { id: 'role-manager', name: 'MANAGER', description: 'Manage workflows and assignments', bitmask: 0, isSystem: true, permissions: ['template:create', 'workflow:manage', 'workflow:assign'] },
  ];
  
  const roles = [];
  for (const role of roleData) {
    const upserted = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, bitmask: role.bitmask, permissions: role.permissions },
      create: role
    });
    roles.push(upserted);
  }
  console.log('Roles ready:', roles.length);
  
  // Create admin user (upsert for idempotency)
  const hash = hashPassword('admin123');
  const user = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: { displayName: 'Admin User', isActive: true },
    create: {
      id: 'user-admin',
      email: 'admin@demo.com',
      passwordHash: hash,
      displayName: 'Admin User',
      publicKey: '02020e45c61d00b16ab0c0d48d8be564a65ac1a3b7e3ec25ba30aa093f6b4c1e8181',
      isActive: true
    }
  });
  console.log('Admin user ready:', user.id);
  
  // Assign roles to admin (upsert for idempotency)
  const adminRole = roles.find(r => r.name === 'ADMIN');
  const approverRole = roles.find(r => r.name === 'APPROVER');
  const requesterRole = roles.find(r => r.name === 'REQUESTER');
  const managerRole = roles.find(r => r.name === 'MANAGER');
  
  for (const role of [adminRole, approverRole, requesterRole, managerRole]) {
    if (role) {
      await prisma.userRole.upsert({
        where: { 
          userId_roleId_orgId_templateId: { 
            userId: user.id, 
            roleId: role.id, 
            orgId: null, 
            templateId: null 
          } 
        },
        update: {},
        create: { userId: user.id, roleId: role.id }
      }).catch(() => {}); // Ignore if already exists with different scope
    }
  }
  console.log('Admin roles assigned');
  
  // Create workflow template (upsert for idempotency)
  const template = await prisma.workflowTemplate.upsert({
    where: { id: 'template-1' },
    update: {},
    create: {
      id: 'template-1',
      orgId: org.id,
      name: 'Approval Workflow',
      status: 'DRAFT',
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
  console.log('Template ready:', template.id);
  
  // NO workflow instance yet - cannot create until template is registered on-chain
  
  await prisma.$disconnect();
  console.log('Seed complete!');
}

seed().catch(e => { console.error(e); process.exit(1); });
