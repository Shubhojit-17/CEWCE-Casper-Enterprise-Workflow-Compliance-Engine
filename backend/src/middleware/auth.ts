// =============================================================================
// Authentication Middleware
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type TokenPayload } from '../lib/jwt.js';
import { createError } from './error-handler.js';
import { logger } from '../lib/logger.js';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Require valid JWT authentication.
 */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw createError('Authorization header required', 401, 'UNAUTHORIZED');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw createError('Invalid authorization format', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);

    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      next(createError('Invalid token', 401, 'INVALID_TOKEN'));
    } else if (error instanceof Error && error.name === 'TokenExpiredError') {
      next(createError('Token expired', 401, 'TOKEN_EXPIRED'));
    } else {
      next(error);
    }
  }
}

/**
 * Optional authentication - populates req.user if token is valid.
 */
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      req.user = verifyToken(token);
    }
  } catch (error) {
    // Ignore invalid tokens for optional auth
    logger.debug({ error }, 'Optional auth token invalid');
  }

  next();
}

/**
 * Require specific role(s) for access.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(createError('Authentication required', 401, 'UNAUTHORIZED'));
      return;
    }

    const hasRole = roles.some(role => req.user!.roles.includes(role));

    if (!hasRole) {
      next(createError('Insufficient permissions', 403, 'FORBIDDEN'));
      return;
    }

    next();
  };
}

/**
 * Block CUSTOMER role from performing an action.
 * Customers can only view and upload documents, not perform workflow transitions.
 * This is a backend-enforced guard - frontend should also hide these actions.
 */
export function blockCustomerRole(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(createError('Authentication required', 401, 'UNAUTHORIZED'));
    return;
  }

  // Check if user ONLY has CUSTOMER role (no other elevated roles)
  const isCustomerOnly = 
    req.user.roles.includes('CUSTOMER') && 
    !req.user.roles.some(r => ['ADMIN', 'MANAGER', 'APPROVER', 'SENIOR_APPROVER', 'REQUESTER', 'USER'].includes(r));

  if (isCustomerOnly) {
    next(createError(
      'Customers cannot perform workflow transitions. Please contact your case manager.',
      403,
      'CUSTOMER_NOT_ALLOWED'
    ));
    return;
  }

  next();
}

/**
 * Require MANAGER role or higher for administrative actions.
 */
export function requireManagerOrAdmin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    next(createError('Authentication required', 401, 'UNAUTHORIZED'));
    return;
  }

  const hasRole = req.user.roles.some(role => ['MANAGER', 'ADMIN'].includes(role));

  if (!hasRole) {
    next(createError('Manager or Admin access required', 403, 'FORBIDDEN'));
    return;
  }

  next();
}
