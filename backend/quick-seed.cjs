const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient({ log: ['query', 'error'] });

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return salt + ':' + hash;
}

async function seed() {
  console.log('Seeding database...');
  console.log('Testing connection...');
  const count = await prisma.user.count();
  console.log('Current user count:', count);
  
  // Create roles
  const roles = [
    { name: 'ADMIN', description: 'Full admin', permissions: ['*'], bitmask: 8, isSystem: true },
    { name: 'AUDITOR', description: 'Auditor', permissions: ['audit:read'], bitmask: 16, isSystem: true },
    { name: 'APPROVER', description: 'Approver', permissions: ['workflow:approve'], bitmask: 2, isSystem: true },
    { name: 'USER', description: 'Basic user', permissions: ['workflow:read'], bitmask: 1, isSystem: true }
  ];
  
  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: role,
      create: role
    });
    console.log('Created role:', role.name);
  }
  
  // Create organization
  const org = await prisma.organization.upsert({
    where: { slug: 'default' },
    update: {},
    create: { name: 'Default Org', slug: 'default', description: 'Demo org' }
  });
  console.log('Created org:', org.name);
  
  // Create admin user
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const existing = await prisma.user.findUnique({ where: { email: 'admin@cewce.local' } });
  
  if (!existing) {
    await prisma.user.create({
      data: {
        email: 'admin@cewce.local',
        passwordHash: hashPassword('Admin123!'),
        displayName: 'Admin',
        firstName: 'System',
        lastName: 'Admin',
        emailVerified: true,
        isActive: true,
        roles: { create: [{ roleId: adminRole.id }] },
        organizationUsers: { create: { orgId: org.id, role: 'ADMIN' } }
      }
    });
    console.log('Created admin user: admin@cewce.local / Admin123!');
  } else {
    console.log('Admin user already exists');
  }
  
  await prisma.$disconnect();
  console.log('Seed complete!');
}

seed().catch(e => { console.error(e); process.exit(1); });
