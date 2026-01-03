// =============================================================================
// Express Server Configuration
// =============================================================================
// Reference: https://expressjs.com/en/4x/api.html
// =============================================================================

import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import { logger } from './lib/logger.js';
import { config } from './lib/config.js';

// Route imports
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { workflowsRouter } from './routes/workflows.js';
import { workflowInstancesRouter } from './routes/workflow-instances.js';
import { usersRouter } from './routes/users.js';
import { auditRouter } from './routes/audit.js';
import { casperRouter } from './routes/casper.js';

// Middleware imports
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { rateLimiter } from './middleware/rate-limiter.js';

export function createServer(): Express {
  const app = express();

  // Trust proxy (for rate limiting behind reverse proxy)
  app.set('trust proxy', 1);

  // Security headers
  // Reference: https://helmetjs.github.io/
  app.use(helmet());

  // CORS configuration
  // Reference: https://github.com/expressjs/cors
  app.use(cors({
    origin: config.corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  }));

  // Compression
  app.use(compression());

  // Request logging
  app.use(pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
  }));

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Rate limiting (applied to API routes)
  app.use('/api', rateLimiter);

  // API Routes
  const apiRouter = express.Router();
  
  // Health check (no auth required)
  apiRouter.use('/health', healthRouter);
  
  // Authentication routes
  apiRouter.use('/auth', authRouter);
  
  // Workflow template management
  apiRouter.use('/workflows', workflowsRouter);
  
  // Workflow instance operations
  apiRouter.use('/workflow-instances', workflowInstancesRouter);
  
  // User management
  apiRouter.use('/users', usersRouter);
  
  // Audit log queries
  apiRouter.use('/audit', auditRouter);
  
  // Casper blockchain interactions
  apiRouter.use('/casper', casperRouter);

  // Mount API router
  app.use('/api/v1', apiRouter);

  // Root redirect to health check
  app.get('/', (_req: Request, res: Response) => {
    res.redirect('/api/v1/health');
  });

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
