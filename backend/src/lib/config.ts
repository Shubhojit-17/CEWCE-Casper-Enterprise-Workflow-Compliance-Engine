// =============================================================================
// Application Configuration
// =============================================================================
// Centralized configuration with validation
// =============================================================================

import { z } from 'zod';

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().int().positive().default(3001),
  host: z.string().default('localhost'),

  // Database
  databaseUrl: z.string().min(1),

  // Redis
  redisHost: z.string().default('localhost'),
  redisPort: z.coerce.number().int().positive().default(6379),
  redisPassword: z.string().optional(),

  // Casper Network
  casperNodeUrl: z.string().url().default('https://rpc.testnet.casperlabs.io/rpc'),
  casperChainName: z.string().default('casper-test'),
  csprCloudAccessToken: z.string().optional(),
  workflowContractHash: z.string().optional(),
  workflowContractPackageHash: z.string().optional(),

  // Casper Sidecar Configuration
  // When enabled, Sidecar is used as primary RPC with automatic fallback to node
  casperSidecarUrl: z.string().optional(),
  casperSidecarRestUrl: z.string().optional(),
  casperSidecarSseUrl: z.string().optional(),
  casperSidecarAdminUrl: z.string().optional(),
  casperUseSidecar: z.coerce.boolean().default(false),
  casperSseEnabled: z.coerce.boolean().default(false),

  // Authentication
  jwtSecret: z.string().min(32),
  jwtExpiry: z.string().default('24h'),

  // CORS
  corsOrigin: z.string().default('http://localhost:5173'),

  // Logging
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  // Rate Limiting
  rateLimitWindowMs: z.coerce.number().int().positive().default(60000),
  rateLimitMaxRequests: z.coerce.number().int().positive().default(100),
});

function loadConfig() {
  const result = configSchema.safeParse({
    nodeEnv: process.env.NODE_ENV,
    port: process.env.PORT,
    host: process.env.HOST,
    databaseUrl: process.env.DATABASE_URL,
    redisHost: process.env.REDIS_HOST,
    redisPort: process.env.REDIS_PORT,
    redisPassword: process.env.REDIS_PASSWORD,
    casperNodeUrl: process.env.CASPER_NODE_URL,
    casperChainName: process.env.CASPER_CHAIN_NAME,
    csprCloudAccessToken: process.env.CSPR_CLOUD_ACCESS_TOKEN,
    workflowContractHash: process.env.WORKFLOW_CONTRACT_HASH,
    workflowContractPackageHash: process.env.WORKFLOW_CONTRACT_PACKAGE_HASH,
    casperSidecarUrl: process.env.CASPER_SIDECAR_URL,
    casperSidecarRestUrl: process.env.CASPER_SIDECAR_REST_URL,
    casperSidecarSseUrl: process.env.CASPER_SIDECAR_SSE_URL,
    casperSidecarAdminUrl: process.env.CASPER_SIDECAR_ADMIN_URL,
    casperUseSidecar: process.env.CASPER_USE_SIDECAR,
    casperSseEnabled: process.env.CASPER_SSE_ENABLED,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiry: process.env.JWT_EXPIRY,
    corsOrigin: process.env.CORS_ORIGIN,
    logLevel: process.env.LOG_LEVEL,
    rateLimitWindowMs: process.env.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: process.env.RATE_LIMIT_MAX_REQUESTS,
  });

  if (!result.success) {
    console.error('Configuration validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();

export type Config = z.infer<typeof configSchema>;
