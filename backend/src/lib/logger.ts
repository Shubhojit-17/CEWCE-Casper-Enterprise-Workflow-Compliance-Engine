// =============================================================================
// Logger Configuration
// =============================================================================
// Reference: https://github.com/pinojs/pino
// =============================================================================

import pino from 'pino';
import { config } from './config.js';

// Cast to call signature since pino types are complex
const pinoLogger = (pino as unknown as typeof pino.default);

export const logger = pinoLogger({
  name: 'cewce-backend',
  level: config.logLevel,
  transport: config.nodeEnv === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
