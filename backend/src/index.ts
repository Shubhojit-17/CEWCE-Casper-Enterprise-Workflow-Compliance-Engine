// =============================================================================
// CEWCE Backend - Application Entry Point
// =============================================================================
// Reference: https://expressjs.com/en/4x/api.html
// =============================================================================

import 'dotenv/config';
import { createServer } from './server.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { initializeQueues } from './jobs/index.js';
import { config } from './lib/config.js';

const PORT = config.port;
const HOST = config.host;

async function main(): Promise<void> {
  logger.info('Starting CEWCE Backend...');

  // Verify database connection
  try {
    await prisma.$connect();
    logger.info('Database connection established');
  } catch (error) {
    logger.fatal({ error }, 'Failed to connect to database');
    process.exit(1);
  }

  // Verify Redis connection
  try {
    await redis.ping();
    logger.info('Redis connection established');
  } catch (error) {
    logger.fatal({ error }, 'Failed to connect to Redis');
    process.exit(1);
  }

  // Initialize background job queues
  try {
    await initializeQueues();
    logger.info('Job queues initialized');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize job queues');
    // Continue without job queues - non-critical for basic operation
  }

  // Create and start Express server
  const app = createServer();

  const server = app.listen(PORT, HOST, () => {
    logger.info({ host: HOST, port: PORT }, 'Server started');
    logger.info(`API available at http://${HOST}:${PORT}/api/v1`);
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
