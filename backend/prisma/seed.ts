// =============================================================================
// Database Seed Script
// =============================================================================
// Creates default roles and admin user for initial setup.
// Run with: npx prisma db seed
// =============================================================================

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Password hashing (same as auth.ts)
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  console.log('🌱 Seeding database...');

  // Create default roles
  const roles = [
    {
      name: 'ADMIN',
      description: 'Full system administrator access',
      permissions: ['*'],
      bitmask: 8, // 1 << 3
      isSystem: true,
    },
    {
      name: 'AUDITOR',
      description: 'Can view audit logs and verify compliance',
      permissions: ['audit:read', 'audit:export', 'workflow:read'],
      bitmask: 16, // 1 << 4
      isSystem: true,
    },
    {
      name: 'SENIOR_APPROVER',
      description: 'Can approve escalated workflows',
      permissions: ['workflow:approve', 'workflow:reject', 'workflow:read'],
      bitmask: 4, // 1 << 2
      isSystem: true,
    },
    {
      name: 'APPROVER',
      description: 'Can approve or reject workflows',
      permissions: ['workflow:approve', 'workflow:reject', 'workflow:read'],
      bitmask: 2, // 1 << 1
      isSystem: true,
    },
    {
      name: 'USER',
      description: 'Regular user with basic permissions',
      permissions: ['workflow:read', 'workflow:create'],
      bitmask: 1, // 1 << 0
      isSystem: true,
    },
    {
      name: 'REQUESTER',
      description: 'Can create workflow instances',
      permissions: ['workflow:create', 'workflow:read'],
      bitmask: 1, // Same as USER
      isSystem: true,
    },
    {
      name: 'CUSTOMER',
      description: 'External customer - can view assigned workflows and upload documents only',
      permissions: ['workflow:read', 'document:upload'],
      bitmask: 128, // 1 << 7
      isSystem: true,
    },
    {
      name: 'MANAGER',
      description: 'Can assign approvers and manage workflow assignments',
      permissions: ['template:create', 'workflow:manage', 'workflow:assign', 'user:read'],
      bitmask: 0, // Legacy - already existed with bitmask 0
      isSystem: true,
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: role,
      create: role,
    });
    console.log(`  ✓ Role: ${role.name}`);
  }

  // Create default organization
  const defaultOrg = await prisma.organization.upsert({
    where: { slug: 'default' },
    update: {},
    create: {
      name: 'Default Organization',
      slug: 'default',
      description: 'Default organization for hackathon demo',
    },
  });
  console.log(`  ✓ Organization: ${defaultOrg.name}`);

  // Create admin user if not exists
  const adminEmail = 'admin@cewce.local';
  const adminPassword = 'Admin123!';

  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const auditorRole = await prisma.role.findUnique({ where: { name: 'AUDITOR' } });

  let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashPassword(adminPassword),
        displayName: 'System Admin',
        firstName: 'System',
        lastName: 'Admin',
        emailVerified: true,
        isActive: true,
        roles: {
          create: [
            { roleId: adminRole!.id },
            { roleId: auditorRole!.id },
          ],
        },
        organizationUsers: {
          create: {
            orgId: defaultOrg.id,
            role: 'ADMIN',
          },
        },
      },
    });
    console.log(`  ✓ Admin user created: ${adminEmail}`);
    console.log(`    Password: ${adminPassword}`);
  } else {
    console.log(`  ✓ Admin user already exists: ${adminEmail}`);
  }

  // Create a demo user for testing
  const demoEmail = 'demo@cewce.local';
  const demoPassword = 'Demo123!';

  const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
  const approverRole = await prisma.role.findUnique({ where: { name: 'APPROVER' } });

  let demoUser = await prisma.user.findUnique({ where: { email: demoEmail } });

  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        email: demoEmail,
        passwordHash: hashPassword(demoPassword),
        displayName: 'Demo User',
        firstName: 'Demo',
        lastName: 'User',
        emailVerified: true,
        isActive: true,
        roles: {
          create: [
            { roleId: userRole!.id },
            { roleId: approverRole!.id },
          ],
        },
        organizationUsers: {
          create: {
            orgId: defaultOrg.id,
            role: 'MEMBER',
          },
        },
      },
    });
    console.log(`  ✓ Demo user created: ${demoEmail}`);
    console.log(`    Password: ${demoPassword}`);
  } else {
    console.log(`  ✓ Demo user already exists: ${demoEmail}`);
  }

  // Create single-role test accounts
  const requesterRole = await prisma.role.findUnique({ where: { name: 'REQUESTER' } });

  // User-only account
  const userOnlyEmail = 'user@cewce.local';
  const userOnlyPassword = 'User123!';
  let userOnlyUser = await prisma.user.findUnique({ where: { email: userOnlyEmail } });
  if (!userOnlyUser) {
    userOnlyUser = await prisma.user.create({
      data: {
        email: userOnlyEmail,
        passwordHash: hashPassword(userOnlyPassword),
        displayName: 'Test User',
        firstName: 'Test',
        lastName: 'User',
        emailVerified: true,
        isActive: true,
        roles: {
          create: [{ roleId: userRole!.id }],
        },
        organizationUsers: {
          create: { orgId: defaultOrg.id, role: 'MEMBER' },
        },
      },
    });
    console.log(`  ✓ User-only account created: ${userOnlyEmail}`);
    console.log(`    Password: ${userOnlyPassword}`);
  } else {
    console.log(`  ✓ User-only account exists: ${userOnlyEmail}`);
  }

  // User1 account
  const user1Email = 'user1@cewce.local';
  const user1Password = 'User1123!';
  let user1 = await prisma.user.findUnique({ where: { email: user1Email } });
  if (!user1) {
    user1 = await prisma.user.create({
      data: {
        email: user1Email,
        passwordHash: hashPassword(user1Password),
        displayName: 'User One',
        firstName: 'User',
        lastName: 'One',
        emailVerified: true,
        isActive: true,
        roles: {
          create: [{ roleId: userRole!.id }],
        },
        organizationUsers: {
          create: { orgId: defaultOrg.id, role: 'MEMBER' },
        },
      },
    });
    console.log(`  ✓ User1 account created: ${user1Email}`);
    console.log(`    Password: ${user1Password}`);
  } else {
    console.log(`  ✓ User1 account exists: ${user1Email}`);
  }

  // User2 account
  const user2Email = 'user2@cewce.local';
  const user2Password = 'User2123!';
  let user2 = await prisma.user.findUnique({ where: { email: user2Email } });
  if (!user2) {
    user2 = await prisma.user.create({
      data: {
        email: user2Email,
        passwordHash: hashPassword(user2Password),
        displayName: 'User Two',
        firstName: 'User',
        lastName: 'Two',
        emailVerified: true,
        isActive: true,
        roles: {
          create: [{ roleId: userRole!.id }],
        },
        organizationUsers: {
          create: { orgId: defaultOrg.id, role: 'MEMBER' },
        },
      },
    });
    console.log(`  ✓ User2 account created: ${user2Email}`);
    console.log(`    Password: ${user2Password}`);
  } else {
    console.log(`  ✓ User2 account exists: ${user2Email}`);
  }

  // Requester-only account
  const requesterOnlyEmail = 'requester@cewce.local';
  const requesterOnlyPassword = 'Requester123!';
  let requesterOnlyUser = await prisma.user.findUnique({ where: { email: requesterOnlyEmail } });
  if (!requesterOnlyUser) {
    requesterOnlyUser = await prisma.user.create({
      data: {
        email: requesterOnlyEmail,
        passwordHash: hashPassword(requesterOnlyPassword),
        displayName: 'Test Requester',
        firstName: 'Test',
        lastName: 'Requester',
        emailVerified: true,
        isActive: true,
        roles: {
          create: [{ roleId: requesterRole!.id }],
        },
        organizationUsers: {
          create: { orgId: defaultOrg.id, role: 'MEMBER' },
        },
      },
    });
    console.log(`  ✓ Requester-only account created: ${requesterOnlyEmail}`);
    console.log(`    Password: ${requesterOnlyPassword}`);
  } else {
    console.log(`  ✓ Requester-only account exists: ${requesterOnlyEmail}`);
  }

  // Approver-only account
  const approverOnlyEmail = 'approver@cewce.local';
  const approverOnlyPassword = 'Approver123!';
  let approverOnlyUser = await prisma.user.findUnique({ where: { email: approverOnlyEmail } });
  if (!approverOnlyUser) {
    approverOnlyUser = await prisma.user.create({
      data: {
        email: approverOnlyEmail,
        passwordHash: hashPassword(approverOnlyPassword),
        displayName: 'Test Approver',
        firstName: 'Test',
        lastName: 'Approver',
        emailVerified: true,
        isActive: true,
        roles: {
          create: [{ roleId: approverRole!.id }],
        },
        organizationUsers: {
          create: { orgId: defaultOrg.id, role: 'MEMBER' },
        },
      },
    });
    console.log(`  ✓ Approver-only account created: ${approverOnlyEmail}`);
    console.log(`    Password: ${approverOnlyPassword}`);
  } else {
    console.log(`  ✓ Approver-only account exists: ${approverOnlyEmail}`);
  }

  // Create a sample workflow template
  const sampleTemplate = await prisma.workflowTemplate.upsert({
    where: { id: 'sample-template' },
    update: {},
    create: {
      id: 'sample-template',
      orgId: defaultOrg.id,
      name: 'Purchase Approval',
      description: 'Standard purchase requisition approval workflow',
      version: 1,
      creatorId: adminUser.id,
      roles: ['USER', 'REQUESTER', 'APPROVER', 'SENIOR_APPROVER', 'ADMIN'],
      states: [
        { id: 0, name: 'Draft', isInitial: true, isTerminal: false },
        { id: 1, name: 'Pending Review', isInitial: false, isTerminal: false },
        { id: 10, name: 'Approved', isInitial: false, isTerminal: true },
        { id: 11, name: 'Rejected', isInitial: false, isTerminal: true },
        { id: 20, name: 'Escalated', isInitial: false, isTerminal: false },
        { id: 30, name: 'Cancelled', isInitial: false, isTerminal: true },
      ],
      transitions: [
        { fromState: 0, toState: 1, name: 'Submit', requiredRoles: ['USER', 'REQUESTER'] },
        { fromState: 1, toState: 10, name: 'Approve', requiredRoles: ['APPROVER', 'ADMIN'] },
        { fromState: 1, toState: 11, name: 'Reject', requiredRoles: ['APPROVER', 'ADMIN'] },
        { fromState: 1, toState: 20, name: 'Escalate', requiredRoles: ['APPROVER', 'ADMIN'] },
        { fromState: 20, toState: 10, name: 'Approve', requiredRoles: ['SENIOR_APPROVER', 'ADMIN'] },
        { fromState: 20, toState: 11, name: 'Reject', requiredRoles: ['SENIOR_APPROVER', 'ADMIN'] },
        { fromState: 0, toState: 30, name: 'Cancel', requiredRoles: ['USER', 'REQUESTER'] },
        { fromState: 1, toState: 30, name: 'Cancel', requiredRoles: ['USER', 'REQUESTER', 'ADMIN'] },
      ],
      slaDays: 7,
      escalationDays: 14,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });
  console.log(`  ✓ Sample template: ${sampleTemplate.name}`);

  console.log('\n✅ Seeding complete!\n');
  console.log('Default credentials:');
  console.log('  Admin:     admin@cewce.local / Admin123!');
  console.log('  Demo:      demo@cewce.local / Demo123!');
  console.log('  User:      user@cewce.local / User123!');
  console.log('  Requester: requester@cewce.local / Requester123!');
  console.log('  Approver:  approver@cewce.local / Approver123!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
