// =============================================================================
// CEWCE Backend - Application Entry Point
// =============================================================================
// Reference: https://expressjs.com/en/4x/api.html
// IMPORTANT: Server starts FIRST for Railway healthcheck, then connects to services
// =============================================================================

import 'dotenv/config';

// CRITICAL: Initialize deployer keys BEFORE any other imports
// This must run before casper.ts is loaded (which happens via server.ts → routes)
import { initializeDeployerKeys } from './lib/deployer-keys.js';
initializeDeployerKeys();

import { createServer } from './server.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { initializeQueues } from './jobs/index.js';

// Railway injects PORT, fallback to 4000 for local development
const PORT = parseInt(process.env.PORT || process.env.APP_PORT || '4000', 10);
const HOST = '0.0.0.0'; // Always bind to 0.0.0.0 for containers

async function connectServices(): Promise<void> {
  // Connect to database
  try {
    await prisma.$connect();
    logger.info('Database connection established');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database - will retry');
    // Don't exit - let the app run and retry
  }

  // Connect to Redis
  try {
    await redis.ping();
    logger.info('Redis connection established');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to Redis - will retry');
    // Don't exit - let the app run and retry
  }

  // Initialize background job queues
  try {
    await initializeQueues();
    logger.info('Job queues initialized');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize job queues');
  }
}

async function main(): Promise<void> {
  logger.info({ port: PORT, host: HOST }, 'Starting CEWCE Backend...');

  // Create Express server
  const app = createServer();

  // START SERVER FIRST - this is critical for Railway healthcheck
  const server = app.listen(PORT, HOST, () => {
    logger.info({ host: HOST, port: PORT }, 'Server started and listening');
    logger.info(`API available at http://${HOST}:${PORT}/api/v1`);
    logger.info(`Healthcheck at http://${HOST}:${PORT}/api/v1/health`);
  });

  // THEN connect to services in background (non-blocking)
  connectServices().catch((error) => {
    logger.error({ error }, 'Error during service connection');
  });

  // Graceful shutdown handlers
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received');

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await prisma.$disconnect();
        logger.info('Database connection closed');
      } catch (error) {
        logger.error({ error }, 'Error closing database connection');
      }

      try {
        await redis.quit();
        logger.info('Redis connection closed');
      } catch (error) {
        logger.error({ error }, 'Error closing Redis connection');
      }

      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.fatal({ error }, 'Unhandled error during startup');
  process.exit(1);
});
