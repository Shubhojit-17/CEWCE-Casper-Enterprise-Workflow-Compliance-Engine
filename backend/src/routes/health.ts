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
