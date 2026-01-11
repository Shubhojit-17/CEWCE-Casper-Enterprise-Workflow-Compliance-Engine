// =============================================================================
// Redis Client
// =============================================================================
// Reference: https://github.com/redis/ioredis
// Supports both REDIS_URL (Railway/cloud) and individual host/port/password config
// =============================================================================

import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

// Cast to constructor since ioredis types are complex with ESM
const RedisClient = Redis as unknown as typeof Redis.default;

// Create Redis connection options
// Priority: REDIS_URL > individual host/port/password settings
function createRedisClient() {
  // If REDIS_URL is provided (Railway, Heroku, etc.), use it directly
  if (config.redisUrl) {
    logger.info('Using REDIS_URL for Redis connection');
    return new RedisClient(config.redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        if (times > 10) {
          logger.error('Redis connection failed after 10 retries');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });
  }

  // Fall back to individual host/port/password settings
  logger.info(`Using Redis host: ${config.redisHost}:${config.redisPort}`);
  return new RedisClient({
    host: config.redisHost,
    port: config.redisPort,
    password: config.redisPassword || undefined,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error('Redis connection failed after 10 retries');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
  });
}

export const redis = createRedisClient();

redis.on('connect', () => {
  logger.debug('Redis client connected');
});

redis.on('error', (error: Error) => {
  logger.error({ error }, 'Redis client error');
});

redis.on('close', () => {
  logger.debug('Redis client connection closed');
});

export type RedisClient = typeof redis;
