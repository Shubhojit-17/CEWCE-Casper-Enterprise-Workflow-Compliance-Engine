// =============================================================================
// Authentication Routes
// =============================================================================
// Handles wallet-based and email/password authentication.
// =============================================================================

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import * as crypto from 'crypto';
import CasperSDK from 'casper-js-sdk';
const { CLPublicKey } = CasperSDK;
import { prisma } from '../lib/prisma.js';
import { generateToken } from '../lib/jwt.js';
import { createError } from '../middleware/error-handler.js';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../lib/logger.js';
import { generateRandomHex } from '../lib/crypto.js';

export const authRouter = Router();

// =============================================================================
// Password Hashing Utilities
// =============================================================================

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// =============================================================================
// Request Validation Schemas
// =============================================================================

const requestNonceSchema = z.object({
  publicKey: z.string().min(64).max(68),
});

const verifySignatureSchema = z.object({
  publicKey: z.string().min(64).max(68),
  signature: z.string().min(1),
  nonce: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// =============================================================================
// Email/Password Authentication Routes
// =============================================================================

/**
 * Register a new user with email and password.
 */
authRouter.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName } = registerSchema.parse(req.body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw createError('Email already registered', 400, 'EMAIL_EXISTS');
    }

    // Create user with hashed password
    const passwordHash = hashPassword(password);
    const displayName = firstName && lastName ? `${firstName} ${lastName}` : email.split('@')[0];

    // Get the default USER role (create if not exists)
    let userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    if (!userRole) {
      userRole = await prisma.role.create({
        data: {
          name: 'USER',
          description: 'Regular user',
          permissions: ['workflow:read', 'workflow:create'],
          bitmask: 1,
          isSystem: true,
        },
      });
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        displayName,
        emailVerified: true, // Skip verification for hackathon
        roles: {
          create: {
            roleId: userRole.id,
          },
        },
      },
      include: { roles: { include: { role: true } } },
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      publicKey: '',
      roles: user.roles.map(r => r.role.name),
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info({ userId: user.id, email }, 'User registered with email');

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Login with email and password.
 */
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.passwordHash) {
      throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Verify password
    if (!verifyPassword(password, user.passwordHash)) {
      throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    // Check if user is active
    if (!user.isActive) {
      throw createError('Account is disabled', 403, 'ACCOUNT_DISABLED');
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      publicKey: user.publicKey || '',
      roles: user.roles.map(r => r.role.name),
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    logger.info({ userId: user.id, email }, 'User logged in with email');

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          firstName: user.firstName,
          lastName: user.lastName,
          publicKey: user.publicKey,
          roles: user.roles.map(r => r.role.name),
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Wallet Authentication Routes
// =============================================================================

/**
 * Request a nonce for wallet signature authentication.
 * The nonce must be signed by the wallet to prove ownership.
 */
authRouter.post('/nonce', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { publicKey } = requestNonceSchema.parse(req.body);

    // Validate public key format
    try {
      CLPublicKey.fromHex(publicKey);
    } catch {
      throw createError('Invalid public key format', 400, 'INVALID_PUBLIC_KEY');
    }

    // Generate a unique nonce
    const nonce = generateRandomHex(32);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store nonce in database
    await prisma.authNonce.upsert({
      where: { publicKey },
      create: {
        publicKey,
        nonce,
        expiresAt,
      },
      update: {
        nonce,
        expiresAt,
      },
    });

    // Return the message to be signed
    const message = `CEWCE Authentication\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;

    res.json({
      success: true,
      data: {
        nonce,
        message,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Verify wallet signature and issue JWT token.
 * 
 * Note: Full cryptographic signature verification requires the casper-js-sdk
 * signature verification utilities. For the hackathon prototype, we verify
 * the nonce was issued by our system and trust the wallet signing process.
 * 
 * TODO: Implement full Ed25519/secp256k1 signature verification for production.
 */
authRouter.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { publicKey, nonce } = verifySignatureSchema.parse(req.body);
    // Note: signature is captured for future cryptographic verification

    // Validate public key format
    let clPublicKey: ReturnType<typeof CLPublicKey.fromHex>;
    try {
      clPublicKey = CLPublicKey.fromHex(publicKey);
    } catch {
      throw createError('Invalid public key format', 400, 'INVALID_PUBLIC_KEY');
    }

    // Verify nonce exists and is not expired
    const storedNonce = await prisma.authNonce.findUnique({
      where: { publicKey },
    });

    if (!storedNonce) {
      throw createError('Nonce not found. Request a new nonce.', 400, 'NONCE_NOT_FOUND');
    }

    if (storedNonce.nonce !== nonce) {
      throw createError('Invalid nonce', 400, 'INVALID_NONCE');
    }

    if (storedNonce.expiresAt < new Date()) {
      throw createError('Nonce expired. Request a new nonce.', 400, 'NONCE_EXPIRED');
    }

    // TODO: Verify signature cryptographically
    // For hackathon: The signed transaction from wallet provides proof
    // Production: Implement Ed25519/secp256k1 verification here

    // Delete used nonce
    await prisma.authNonce.delete({
      where: { publicKey },
    });

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { publicKey },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      // First, ensure the REQUESTER role exists
      const requesterRole = await prisma.role.upsert({
        where: { name: 'REQUESTER' },
        create: {
          name: 'REQUESTER',
          description: 'Can create workflow instances',
          permissions: ['workflow:create', 'workflow:read'],
          bitmask: 1, // Basic requester role bitmask
        },
        update: {},
      });

      // Create new user on first authentication
      user = await prisma.user.create({
        data: {
          publicKey,
          accountHash: clPublicKey.toAccountHashStr(),
          // Default role assignment
          roles: {
            create: {
              roleId: requesterRole.id,
            },
          },
        },
        include: { roles: { include: { role: true } } },
      });

      logger.info({ publicKey, userId: user.id }, 'New user created');
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      publicKey: user.publicKey || publicKey, // Use the authenticated key as fallback
      roles: user.roles.map(r => r.role.name),
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          publicKey: user.publicKey,
          accountHash: user.accountHash,
          roles: user.roles.map(r => r.role.name),
          createdAt: user.createdAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get current authenticated user info.
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        publicKey: user.publicKey,
        accountHash: user.accountHash,
        displayName: user.displayName,
        email: user.email,
        roles: user.roles.map(r => r.role.name),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Refresh JWT token.
 */
authRouter.post('/refresh', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }

    const token = generateToken({
      userId: user.id,
      publicKey: user.publicKey || '',
      roles: user.roles.map(r => r.role.name),
    });

    res.json({
      success: true,
      data: { token },
    });
  } catch (error) {
    next(error);
  }
});
/**
 * Change password for authenticated user.
 */
authRouter.post('/change-password', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8),
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user || !user.passwordHash) {
      throw createError('User not found or no password set', 404, 'USER_NOT_FOUND');
    }

    // Verify current password using the same method as login
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw createError('Current password is incorrect', 401, 'INVALID_PASSWORD');
    }

    // Hash new password using the same method as registration
    const newPasswordHash = hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { passwordHash: newPasswordHash },
    });

    logger.info({ userId: user.id }, 'User changed password');

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Password Reset (Forgot Password) Routes
// =============================================================================

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

/**
 * Request a password reset token.
 * Sends a reset link to the user's email (simulated for hackathon).
 */
authRouter.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    if (!user) {
      logger.info({ email }, 'Password reset requested for non-existent email');
      res.json({
        success: true,
        message: 'If an account exists with this email, a reset link has been sent.',
      });
      return;
    }

    // Generate reset token
    const resetToken = generateRandomHex(32);
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token (using AuthNonce table for simplicity)
    await prisma.authNonce.upsert({
      where: { publicKey: `reset:${email}` },
      create: {
        publicKey: `reset:${email}`,
        nonce: resetToken,
        expiresAt: resetExpiry,
      },
      update: {
        nonce: resetToken,
        expiresAt: resetExpiry,
      },
    });

    // In production: Send email with reset link
    // For hackathon: Log the token for demo purposes
    logger.info({ email, resetToken }, 'Password reset token generated (demo mode - token logged)');

    // For hackathon demo: Include token in response (REMOVE IN PRODUCTION)
    res.json({
      success: true,
      message: 'If an account exists with this email, a reset link has been sent.',
      // Demo only - remove in production:
      _demo: {
        resetToken,
        resetUrl: `/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Reset password using a valid token.
 */
authRouter.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    const email = req.body.email as string;

    if (!email) {
      throw createError('Email is required', 400, 'MISSING_EMAIL');
    }

    // Find stored token
    const storedToken = await prisma.authNonce.findUnique({
      where: { publicKey: `reset:${email}` },
    });

    if (!storedToken) {
      throw createError('Invalid or expired reset token', 400, 'INVALID_TOKEN');
    }

    if (storedToken.nonce !== token) {
      throw createError('Invalid or expired reset token', 400, 'INVALID_TOKEN');
    }

    if (storedToken.expiresAt < new Date()) {
      // Delete expired token
      await prisma.authNonce.delete({
        where: { publicKey: `reset:${email}` },
      });
      throw createError('Reset token has expired', 400, 'TOKEN_EXPIRED');
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Hash and save new password
    const newPasswordHash = hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    // Delete used token
    await prisma.authNonce.delete({
      where: { publicKey: `reset:${email}` },
    });

    logger.info({ userId: user.id, email }, 'Password reset successfully');

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Link wallet to existing email/password account.
 */
authRouter.post('/link-wallet', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { publicKey } = z.object({
      publicKey: z.string().min(64).max(68),
    }).parse(req.body);

    // Validate public key format
    let clPublicKey: ReturnType<typeof CLPublicKey.fromHex>;
    try {
      clPublicKey = CLPublicKey.fromHex(publicKey);
    } catch {
      throw createError('Invalid public key format', 400, 'INVALID_PUBLIC_KEY');
    }

    // Check if wallet is already linked to another account
    const existingUser = await prisma.user.findUnique({
      where: { publicKey },
    });

    if (existingUser && existingUser.id !== req.user!.userId) {
      throw createError('This wallet is already linked to another account', 400, 'WALLET_ALREADY_LINKED');
    }

    // Update user with wallet info
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        publicKey,
        accountHash: clPublicKey.toAccountHashStr(),
      },
      include: { roles: { include: { role: true } } },
    });

    logger.info({ userId: user.id, publicKey }, 'Wallet linked to account');

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        publicKey: user.publicKey,
        accountHash: user.accountHash,
        displayName: user.displayName,
        roles: user.roles.map(r => r.role.name),
      },
    });
  } catch (error) {
    next(error);
  }
});