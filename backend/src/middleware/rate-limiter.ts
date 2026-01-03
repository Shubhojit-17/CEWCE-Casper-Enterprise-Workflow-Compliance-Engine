// =============================================================================
// Rate Limiter Middleware
// =============================================================================
// Simple in-memory rate limiter. For production, use Redis-based limiting.
// =============================================================================

import type { Request, Response, NextFunction } from 'express';
import { config } from '../lib/config.js';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Use IP address as identifier (or user ID if authenticated)
  const identifier = req.ip || 'unknown';
  const now = Date.now();

  let entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetTime < now) {
    // Create new entry
    entry = {
      count: 1,
      resetTime: now + config.rateLimitWindowMs,
    };
    rateLimitStore.set(identifier, entry);
  } else {
    entry.count++;
  }

  // Set rate limit headers
  res.setHeader('X-RateLimit-Limit', config.rateLimitMaxRequests.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, config.rateLimitMaxRequests - entry.count).toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());

  if (entry.count > config.rateLimitMaxRequests) {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      },
    });
    return;
  }

  next();
}
