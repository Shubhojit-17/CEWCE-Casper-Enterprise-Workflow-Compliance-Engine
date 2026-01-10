const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.count().then(c => console.log('Users:', c)).finally(() => prisma.$disconnect());
