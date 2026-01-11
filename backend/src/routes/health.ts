// =============================================================================
// Health Check Routes
// =============================================================================

import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { getStateRootHash } from '../lib/casper.js';
import { logger } from '../lib/logger.js';

export const healthRouter = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    casper: 'up' | 'down';
  };
}

healthRouter.get('/', async (_req: Request, res: Response) => {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    services: {
      database: 'down',
      redis: 'down',
      casper: 'down',
    },
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'up';
  } catch (error) {
    logger.error({ error }, 'Database health check failed');
    health.status = 'degraded';
  }

  // Check Redis
  try {
    await redis.ping();
    health.services.redis = 'up';
  } catch (error) {
    logger.error({ error }, 'Redis health check failed');
    health.status = 'degraded';
  }

  // Check Casper node connectivity
  try {
    await getStateRootHash();
    health.services.casper = 'up';
  } catch (error) {
    logger.error({ error }, 'Casper health check failed');
    health.status = 'degraded';
  }

  // If all services are down, mark as unhealthy
  const allDown = Object.values(health.services).every(s => s === 'down');
  if (allDown) {
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
});

// Kubernetes liveness probe
healthRouter.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'alive' });
});

// Kubernetes readiness probe
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ready' });
  } catch (error) {
    res.status(503).json({ status: 'not ready' });
  }
});

// Database seeding endpoint (for Railway deployment)
healthRouter.post('/seed', async (req: Request, res: Response) => {
  const seedKey = req.headers['x-seed-key'] || req.query.key;
  const expectedKey = process.env.SEED_KEY || 'cewce-seed-2026';
  
  if (seedKey !== expectedKey) {
    res.status(401).json({ error: 'Invalid seed key' });
    return;
  }

  try {
    logger.info('Running database seed...');
    
    // Create roles
    const roleData = [
      { name: 'USER', description: 'Basic user access', bitmask: 1, permissions: ['workflow:read', 'workflow:create'] },
      { name: 'REQUESTER', description: 'Can create workflow instances', bitmask: 1, permissions: ['workflow:create', 'workflow:read'] },
      { name: 'APPROVER', description: 'Can approve/reject workflows', bitmask: 2, permissions: ['workflow:approve', 'workflow:reject', 'workflow:read'] },
      { name: 'SENIOR_APPROVER', description: 'Can approve escalated workflows', bitmask: 4, permissions: ['workflow:approve', 'workflow:reject', 'workflow:read'] },
      { name: 'ADMIN', description: 'Full system administrator', bitmask: 8, permissions: ['*'] },
      { name: 'AUDITOR', description: 'View audit logs', bitmask: 16, permissions: ['audit:read', 'audit:export', 'workflow:read'] },
      { name: 'VIEWER', description: 'View-only access', bitmask: 32, permissions: ['workflow:read'] },
      { name: 'CUSTOMER', description: 'External customer', bitmask: 128, permissions: ['workflow:read', 'document:upload'] },
      { name: 'MANAGER', description: 'Manage workflows', bitmask: 0, permissions: ['template:create', 'workflow:manage', 'workflow:assign'] },
    ];

    const roles = [];
    for (const role of roleData) {
      const upserted = await prisma.role.upsert({
        where: { name: role.name },
        update: { description: role.description, bitmask: role.bitmask, permissions: role.permissions },
        create: { ...role, isSystem: true }
      });
      roles.push(upserted);
    }
    logger.info(`Roles seeded: ${roles.length}`);

    // Create organization
    const org = await prisma.organization.upsert({
      where: { slug: 'demo-corp' },
      update: {},
      create: { name: 'Demo Corp', slug: 'demo-corp' }
    });
    logger.info(`Organization ready: ${org.slug}`);

    // Assign roles to existing users who don't have them
    const users = await prisma.user.findMany();
    const adminRole = roles.find(r => r.name === 'ADMIN');
    const approverRole = roles.find(r => r.name === 'APPROVER');
    const requesterRole = roles.find(r => r.name === 'REQUESTER');
    const managerRole = roles.find(r => r.name === 'MANAGER');

    for (const user of users) {
      const existingRoles = await prisma.userRole.findMany({ where: { userId: user.id } });
      if (existingRoles.length === 0 || existingRoles.length < 3) {
        // Give all main roles to make user functional
        for (const role of [adminRole, approverRole, requesterRole, managerRole]) {
          if (role) {
            await prisma.userRole.upsert({
              where: { 
                userId_roleId_orgId_templateId: { userId: user.id, roleId: role.id, orgId: null, templateId: null }
              },
              update: {},
              create: { userId: user.id, roleId: role.id }
            }).catch(() => {});
          }
        }
      }
    }
    logger.info(`User roles assigned`);

    res.json({ 
      success: true, 
      roles: roles.map(r => r.name),
      users: users.map(u => u.email),
      organization: org.slug
    });
  } catch (error) {
    logger.error({ error }, 'Seed failed');
    res.status(500).json({ error: 'Seed failed', details: String(error) });
  }
});
