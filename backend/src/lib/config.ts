// =============================================================================
// Application Configuration
// =============================================================================
// Centralized configuration with validation
// =============================================================================

import { z } from 'zod';

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().int().positive().default(3001),
  host: z.string().default('0.0.0.0'),

  // Database
  databaseUrl: z.string().min(1),

  // Redis
  redisUrl: z.string().optional(), // Full Redis URL (e.g., from Railway)
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

  // CORS - supports comma-separated origins
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
    port: process.env.PORT || process.env.APP_PORT, // Railway uses PORT, local might use APP_PORT
    host: process.env.HOST || process.env.APP_HOST || '0.0.0.0', // Default to 0.0.0.0 for containers
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    redisHost: process.env.REDIS_HOST || process.env.REDISHOST, // Railway uses REDISHOST
    redisPort: process.env.REDIS_PORT || process.env.REDISPORT, // Railway uses REDISPORT
    redisPassword: process.env.REDIS_PASSWORD || process.env.REDISPASSWORD, // Railway uses REDISPASSWORD
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
    console.error('='.repeat(60));
    console.error('CONFIGURATION VALIDATION FAILED');
    console.error('='.repeat(60));
    console.error('Environment variables received:');
    console.error('  PORT:', process.env.PORT);
    console.error('  APP_PORT:', process.env.APP_PORT);
    console.error('  HOST:', process.env.HOST);
    console.error('  APP_HOST:', process.env.APP_HOST);
    console.error('  DATABASE_URL:', process.env.DATABASE_URL ? '[SET]' : '[NOT SET]');
    console.error('  REDIS_URL:', process.env.REDIS_URL ? '[SET]' : '[NOT SET]');
    console.error('  REDIS_HOST:', process.env.REDIS_HOST);
    console.error('  REDISHOST:', process.env.REDISHOST);
    console.error('  JWT_SECRET:', process.env.JWT_SECRET ? '[SET]' : '[NOT SET]');
    console.error('='.repeat(60));
    console.error('Validation errors:');
    console.error(JSON.stringify(result.error.format(), null, 2));
    console.error('='.repeat(60));
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();

export type Config = z.infer<typeof configSchema>;
