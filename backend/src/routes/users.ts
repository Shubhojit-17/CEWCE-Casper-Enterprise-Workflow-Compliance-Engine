// =============================================================================
// User Management Routes
// =============================================================================

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createError } from '../middleware/error-handler.js';

export const usersRouter = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const updateUserSchema = z.object({
  displayName: z.string().max(200).optional(),
  email: z.string().email().optional(),
});

const assignRoleSchema = z.object({
  roleName: z.string().min(1),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * List all users (admin only).
 */
usersRouter.get(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = '1', limit = '20' } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);
      const skip = (pageNum - 1) * limitNum;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            roles: {
              include: { role: true },
            },
          },
        }),
        prisma.user.count(),
      ]);

      res.json({
        success: true,
        data: {
          users: users.map(u => ({
            id: u.id,
            publicKey: u.publicKey,
            accountHash: u.accountHash,
            displayName: u.displayName,
            email: u.email,
            roles: u.roles.map(r => r.role.name),
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * List users who can be assigned as customers.
 * Available to REQUESTER, MANAGER, ADMIN, and APPROVER roles.
 * Returns users with USER or CUSTOMER roles.
 * For non-authorized roles, returns empty list instead of error.
 */
usersRouter.get(
  '/assignable-customers',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if user has permission to assign customers
      const userRoles = req.user!.roles;
      const canAssign = userRoles.some(r => 
        ['REQUESTER', 'MANAGER', 'ADMIN', 'APPROVER', 'SENIOR_APPROVER'].includes(r)
      );
      
      // Return empty list for non-authorized users instead of error
      if (!canAssign) {
        res.json({
          success: true,
          data: {
            users: [],
          },
        });
        return;
      }

      // Find users with USER or CUSTOMER roles
      const customersAndUsers = await prisma.user.findMany({
        where: {
          isActive: true,
          roles: {
            some: {
              role: {
                name: { in: ['USER', 'CUSTOMER'] },
              },
            },
          },
        },
        include: {
          roles: {
            include: { role: true },
          },
        },
        orderBy: { email: 'asc' },
      });

      res.json({
        success: true,
        data: {
          users: customersAndUsers.map(u => ({
            id: u.id,
            email: u.email,
            displayName: u.displayName,
            firstName: u.firstName,
            lastName: u.lastName,
            roles: u.roles.map(r => r.role.name),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get current user's profile.
 */
usersRouter.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw createError('User not found', 404, 'NOT_FOUND');
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        publicKey: user.publicKey,
        accountHash: user.accountHash,
        displayName: user.displayName,
        email: user.email,
        firstName: user.displayName?.split(' ')[0] || null,
        lastName: user.displayName?.split(' ').slice(1).join(' ') || null,
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
 * Update current user's profile.
 */
usersRouter.patch('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({
      firstName: z.string().max(100).optional(),
      lastName: z.string().max(100).optional(),
      email: z.string().email().optional(),
    }).parse(req.body);

    // Combine firstName and lastName into displayName
    const displayName = [data.firstName, data.lastName].filter(Boolean).join(' ') || undefined;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        displayName,
        email: data.email,
      },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        publicKey: user.publicKey,
        accountHash: user.accountHash,
        displayName: user.displayName,
        email: user.email,
        firstName: user.displayName?.split(' ')[0] || null,
        lastName: user.displayName?.split(' ').slice(1).join(' ') || null,
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
 * Get a specific user.
 */
usersRouter.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Users can view themselves, admins can view anyone
    if (id !== req.user!.userId && !req.user!.roles.includes('ADMIN')) {
      throw createError('Forbidden', 403, 'FORBIDDEN');
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

    if (!user) {
      throw createError('User not found', 404, 'NOT_FOUND');
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
 * Update user profile.
 */
usersRouter.patch('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = updateUserSchema.parse(req.body);

    // Users can update themselves, admins can update anyone
    if (id !== req.user!.userId && !req.user!.roles.includes('ADMIN')) {
      throw createError('Forbidden', 403, 'FORBIDDEN');
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      include: {
        roles: {
          include: { role: true },
        },
      },
    });

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
 * Assign a role to a user (admin only).
 */
usersRouter.post(
  '/:id/roles',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { roleName } = assignRoleSchema.parse(req.body);

      // Verify user exists
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        throw createError('User not found', 404, 'NOT_FOUND');
      }

      // Get or create role
      const role = await prisma.role.upsert({
        where: { name: roleName },
        create: {
          name: roleName,
          permissions: [],
          bitmask: 0, // Will need to be set properly based on role
        },
        update: {},
      });

      // Check if already assigned (using the composite unique key)
      const existing = await prisma.userRole.findFirst({
        where: {
          userId: id,
          roleId: role.id,
          orgId: null,
          templateId: null,
        },
      });

      if (existing) {
        throw createError('Role already assigned', 400, 'ROLE_ALREADY_ASSIGNED');
      }

      // Assign role
      await prisma.userRole.create({
        data: {
          userId: id,
          roleId: role.id,
        },
      });

      res.json({
        success: true,
        message: `Role ${roleName} assigned to user`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Remove a role from a user (admin only).
 */
usersRouter.delete(
  '/:id/roles/:roleName',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, roleName } = req.params;

      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (!role) {
        throw createError('Role not found', 404, 'ROLE_NOT_FOUND');
      }

      // Find and delete the user role assignment
      const userRole = await prisma.userRole.findFirst({
        where: {
          userId: id,
          roleId: role.id,
          orgId: null,
          templateId: null,
        },
      });

      if (!userRole) {
        throw createError('User does not have this role', 404, 'ROLE_NOT_ASSIGNED');
      }

      await prisma.userRole.delete({
        where: {
          id: userRole.id,
        },
      });

      res.json({
        success: true,
        message: `Role ${roleName} removed from user`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * List all available roles.
 */
usersRouter.get('/roles/all', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: { roles },
    });
  } catch (error) {
    next(error);
  }
});
