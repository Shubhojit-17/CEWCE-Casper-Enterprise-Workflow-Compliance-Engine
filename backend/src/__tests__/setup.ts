import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

// Mock Prisma client - use path without extension for Jest compatibility
jest.mock('../lib/prisma', () => ({
  __esModule: true,
  prisma: mockDeep<PrismaClient>(),
}));

// Mock Redis
jest.mock('../lib/redis', () => ({
  __esModule: true,
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    setex: jest.fn(),
    expire: jest.fn(),
    quit: jest.fn(),
  },
}));

// Mock Logger
jest.mock('../lib/logger', () => ({
  __esModule: true,
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
});

// Increase timeout for integration tests
jest.setTimeout(30000);

// Environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CASPER_NODE_URL = 'https://testnet.cspr.live/rpc';
process.env.CASPER_CHAIN_NAME = 'casper-test';

export type Context = {
  prisma: DeepMockProxy<PrismaClient>;
};
