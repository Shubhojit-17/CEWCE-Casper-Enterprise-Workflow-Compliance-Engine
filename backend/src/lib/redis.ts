// =============================================================================
// Redis Client
// =============================================================================
// Reference: https://github.com/redis/ioredis
// =============================================================================

import Redis from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

// Cast to constructor since ioredis types are complex with ESM
const RedisClient = Redis as unknown as typeof Redis.default;

export const redis = new RedisClient({
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
