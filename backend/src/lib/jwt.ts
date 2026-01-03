// =============================================================================
// JWT Authentication Utilities
// =============================================================================

import jwt from 'jsonwebtoken';
import { config } from './config.js';

export interface TokenPayload {
  userId: string;
  publicKey: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for an authenticated user.
 */
export function generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiry as string,
  } as jwt.SignOptions);
}

/**
 * Verify and decode a JWT token.
 */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as TokenPayload;
}

/**
 * Decode a token without verification (for debugging).
 */
export function decodeToken(token: string): TokenPayload | null {
  return jwt.decode(token) as TokenPayload | null;
}
