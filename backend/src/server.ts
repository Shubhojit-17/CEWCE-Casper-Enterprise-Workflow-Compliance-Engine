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
import { complianceProofRouter } from './routes/compliance-proofs.js';

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
  // Support multiple origins via comma-separated CORS_ORIGIN env var
  const allowedOrigins = config.corsOrigin.split(',').map(o => o.trim());
  logger.info({ allowedOrigins }, 'CORS allowed origins');
  
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      
      // In development or production, allow if origin matches pattern
      // This helps with Vercel preview deployments and Railway
      if (origin.includes('vercel.app') || origin.includes('localhost') || origin.includes('railway.app') || origin.includes('up.railway.app')) {
        logger.info({ origin }, 'Allowing Vercel/Railway/localhost origin');
        return callback(null, true);
      }
      
      logger.warn({ origin, allowedOrigins }, 'CORS rejected origin');
      callback(null, false); // Don't throw error, just reject
    },
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

  // Root health check for Railway/load balancers
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

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
  
  // Compliance proof verification
  apiRouter.use('/compliance-proofs', complianceProofRouter);

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
