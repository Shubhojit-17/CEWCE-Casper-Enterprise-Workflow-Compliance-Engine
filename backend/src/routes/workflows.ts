// =============================================================================
// Workflow Template Routes
// =============================================================================
// Manage workflow definitions (templates).
// =============================================================================

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { TemplateStatus, InstanceStatus, type Prisma } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createError } from '../middleware/error-handler.js';
import { sha256Hex, sha256Bytes } from '../lib/crypto.js';
import { 
  registerWorkflowTemplateOnChain, 
  isServerSigningAvailable,
} from '../lib/casper.js';
import { addTemplateRegistrationJob } from '../jobs/template-registration.js';
import { logger } from '../lib/logger.js';

export const workflowsRouter = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const workflowStateSchema = z.object({
  id: z.number().int().min(0).max(255),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  isInitial: z.boolean().default(false),
  isTerminal: z.boolean().default(false),
});

const workflowTransitionSchema = z.object({
  fromState: z.number().int().min(0).max(255).optional(),
  toState: z.number().int().min(0).max(255).optional(),
  from: z.number().int().min(0).max(255).optional(),
  to: z.number().int().min(0).max(255).optional(),
  name: z.string().min(1).max(100).optional(),
  action: z.string().optional(),
  label: z.string().optional(),
  requiredRoles: z.array(z.string()).optional(),
  conditions: z.record(z.unknown()).optional(),
}).transform((t) => ({
  fromState: t.fromState ?? t.from ?? 0,
  toState: t.toState ?? t.to ?? 0,
  name: t.name ?? t.action ?? t.label ?? 'transition',
  requiredRoles: t.requiredRoles ?? ['USER'],
  conditions: t.conditions,
}));

const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  version: z.string().default('1.0.0'),
  states: z.array(workflowStateSchema).min(2), // At least initial and terminal
  transitions: z.array(workflowTransitionSchema).min(1),
  slaDays: z.number().int().min(1).max(365).optional().default(7),
  escalationDays: z.number().int().min(1).max(365).optional().default(14),
  metadata: z.record(z.unknown()).optional(),
});

const updateWorkflowSchema = createWorkflowSchema.partial();

// =============================================================================
// Routes
// =============================================================================

/**
 * Get workflow statistics for dashboard.
 */
workflowsRouter.get('/stats', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [total, pending, completed, escalated] = await Promise.all([
      prisma.workflowInstance.count(),
      prisma.workflowInstance.count({
        where: { 
          status: InstanceStatus.PENDING,
        },
      }),
      prisma.workflowInstance.count({
        where: { status: InstanceStatus.COMPLETED },
      }),
      prisma.workflowInstance.count({
        where: { status: InstanceStatus.ESCALATED },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalWorkflows: total,
        pendingWorkflows: pending,
        completedWorkflows: completed,
        escalatedWorkflows: escalated,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * List all workflow templates.
 */
workflowsRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', active } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    // Filter by status instead of isActive boolean
    const where: Prisma.WorkflowTemplateWhereInput = active !== undefined 
      ? { status: active === 'true' ? TemplateStatus.PUBLISHED : TemplateStatus.DRAFT } 
      : {};

    const [workflows, total] = await Promise.all([
      prisma.workflowTemplate.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          version: true,
          states: true,
          transitions: true,
          slaDays: true,
          escalationDays: true,
          contractHash: true,
          onChainWorkflowId: true,
          registrationDeployHash: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { instances: true },
          },
        },
      }),
      prisma.workflowTemplate.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        workflows: workflows.map(w => {
          // Flag legacy templates (PUBLISHED but no blockchain ID)
          const isLegacy = w.status === 'PUBLISHED' && !w.onChainWorkflowId;
          return {
            ...w,
            instanceCount: w._count.instances,
            isActive: w.status === 'PUBLISHED', // Compute isActive for backwards compatibility
            // Convert BigInt to string for JSON serialization
            onChainWorkflowId: w.onChainWorkflowId?.toString() || null,
            _count: undefined,
            // Legacy template flag
            isLegacy,
          };
        }),
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
});

/**
 * Get a specific workflow template.
 */
workflowsRouter.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const workflow = await prisma.workflowTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: { instances: true },
        },
      },
    });

    if (!workflow) {
      throw createError('Workflow template not found', 404, 'NOT_FOUND');
    }

    // Flag legacy templates (PUBLISHED but no blockchain ID)
    const isLegacy = workflow.status === 'PUBLISHED' && !workflow.onChainWorkflowId;

    res.json({
      success: true,
      data: {
        ...workflow,
        instanceCount: workflow._count.instances,
        // Convert BigInt to string for JSON serialization
        onChainWorkflowId: workflow.onChainWorkflowId?.toString() || null,
        _count: undefined,
        // Legacy template flag
        isLegacy,
        legacyMessage: isLegacy 
          ? 'This template was created before blockchain enforcement. It must be republished or archived.'
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a new workflow template.
 * Requires ADMIN role.
 */
workflowsRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = createWorkflowSchema.parse(req.body);

      // Validate state machine
      const initialStates = data.states.filter(s => s.isInitial);
      const terminalStates = data.states.filter(s => s.isTerminal);

      if (initialStates.length !== 1) {
        throw createError('Workflow must have exactly one initial state', 400, 'INVALID_WORKFLOW');
      }

      if (terminalStates.length < 1) {
        throw createError('Workflow must have at least one terminal state', 400, 'INVALID_WORKFLOW');
      }

      // Validate transitions reference valid states
      const stateIds = new Set(data.states.map(s => s.id));
      for (const transition of data.transitions) {
        if (!stateIds.has(transition.fromState)) {
          throw createError(`Invalid fromState: ${transition.fromState}`, 400, 'INVALID_TRANSITION');
        }
        if (!stateIds.has(transition.toState)) {
          throw createError(`Invalid toState: ${transition.toState}`, 400, 'INVALID_TRANSITION');
        }
      }

      // Generate contract hash for on-chain reference
      const definition = {
        name: data.name,
        version: data.version,
        states: data.states,
        transitions: data.transitions,
      };
      const contractHash = sha256Hex(JSON.stringify(definition));

      // Get user's organization (create default if none exists)
      let orgUser = await prisma.organizationUser.findFirst({
        where: { userId: req.user!.userId },
      });
      
      if (!orgUser) {
        // Create a default organization for the user
        const defaultOrg = await prisma.organization.upsert({
          where: { slug: 'default' },
          update: {},
          create: {
            name: 'Default Organization',
            slug: 'default',
          },
        });
        orgUser = await prisma.organizationUser.create({
          data: {
            userId: req.user!.userId,
            orgId: defaultOrg.id,
            role: 'OWNER',
          },
        });
      }

      const workflow = await prisma.workflowTemplate.create({
        data: {
          orgId: orgUser.orgId,
          name: data.name,
          description: data.description,
          version: parseInt(data.version, 10) || 1,
          states: JSON.parse(JSON.stringify(data.states)), // Ensure JSON-serializable
          transitions: JSON.parse(JSON.stringify(data.transitions)), // Ensure JSON-serializable
          slaDays: data.slaDays,
          escalationDays: data.escalationDays,
          metadata: JSON.parse(JSON.stringify(data.metadata || {})), // Ensure JSON-serializable
          contractHash,
        },
      });

      res.status(201).json({
        success: true,
        data: {
          ...workflow,
          // Convert BigInt to string for JSON serialization
          onChainWorkflowId: workflow.onChainWorkflowId?.toString() || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update a workflow template.
 * Creates a new version if instances exist.
 * Requires ADMIN role.
 */
workflowsRouter.put(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data = updateWorkflowSchema.parse(req.body);

      const existing = await prisma.workflowTemplate.findUnique({
        where: { id },
        include: { _count: { select: { instances: true } } },
      });

      if (!existing) {
        throw createError('Workflow template not found', 404, 'NOT_FOUND');
      }

      // If instances exist, create new version instead of updating
      if (existing._count.instances > 0) {
        // Increment version
        const newVersion = existing.version + 1;

        const definition = {
          name: data.name || existing.name,
          version: newVersion,
          states: data.states || existing.states,
          transitions: data.transitions || existing.transitions,
        };
        const contractHash = sha256Hex(JSON.stringify(definition));

        // Archive old version
        await prisma.workflowTemplate.update({
          where: { id },
          data: { status: 'DEPRECATED' },
        });

        // Create new version
        const workflow = await prisma.workflowTemplate.create({
          data: {
            orgId: existing.orgId,
            name: data.name || existing.name,
            description: data.description ?? existing.description,
            version: newVersion,
            states: JSON.parse(JSON.stringify(data.states || existing.states)),
            transitions: JSON.parse(JSON.stringify(data.transitions || existing.transitions)),
            metadata: JSON.parse(JSON.stringify(data.metadata || existing.metadata)),
            contractHash,
          },
        });

        res.json({
          success: true,
          data: {
            ...workflow,
            onChainWorkflowId: workflow.onChainWorkflowId?.toString() || null,
          },
          message: 'New version created (existing instances preserved)',
        });
      } else {
        // No instances, safe to update in place
        const definition = {
          name: data.name || existing.name,
          version: data.version ? parseInt(String(data.version), 10) : existing.version,
          states: data.states || existing.states,
          transitions: data.transitions || existing.transitions,
        };
        const contractHash = sha256Hex(JSON.stringify(definition));

        const workflow = await prisma.workflowTemplate.update({
          where: { id },
          data: {
            name: data.name,
            description: data.description,
            version: data.version ? parseInt(String(data.version), 10) : undefined,
            states: data.states ? JSON.parse(JSON.stringify(data.states)) : undefined,
            transitions: data.transitions ? JSON.parse(JSON.stringify(data.transitions)) : undefined,
            metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
            contractHash,
          },
        });

        res.json({
          success: true,
          data: {
            ...workflow,
            onChainWorkflowId: workflow.onChainWorkflowId?.toString() || null,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Partial update of a workflow template (e.g., publish/deprecate).
 * When publishing, the template is registered on-chain to get an onChainWorkflowId.
 * Requires ADMIN role.
 */
workflowsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const patchSchema = z.object({
        status: z.enum(['DRAFT', 'PUBLISHED', 'DEPRECATED', 'ARCHIVED']).optional(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
      });
      
      const data = patchSchema.parse(req.body);

      const existing = await prisma.workflowTemplate.findUnique({
        where: { id },
      });

      if (!existing) {
        throw createError('Workflow template not found', 404, 'NOT_FOUND');
      }

      const updateData: Record<string, unknown> = {};
      
      // Handle on-chain registration when publishing
      if (data.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
        // Check if already registered on-chain
        if (existing.onChainWorkflowId) {
          logger.info({ templateId: id, onChainWorkflowId: existing.onChainWorkflowId.toString() }, 
            'Template already registered on-chain');
        } else if (!isServerSigningAvailable()) {
          // Server-side signing not available - warn but allow publish
          logger.warn({ templateId: id }, 
            'Server-side signing unavailable. Template will be published without on-chain registration.');
        } else {
          // Register template on-chain
          logger.info({ templateId: id }, 'Registering workflow template on-chain');
          
          // Create hashes for on-chain storage
          const templateDefinition = {
            states: existing.states,
            transitions: existing.transitions,
          };
          const templateHash = sha256Bytes(JSON.stringify(templateDefinition));
          
          const metadata = {
            name: existing.name,
            version: existing.version,
            description: existing.description,
            contractHash: existing.contractHash,
          };
          const metadataHash = sha256Bytes(JSON.stringify(metadata));
          
          // Submit registration deploy
          const registrationResult = await registerWorkflowTemplateOnChain(templateHash, metadataHash);
          
          if (!registrationResult.success) {
            logger.error({ templateId: id, error: registrationResult.error }, 
              'Failed to register template on-chain');
            throw createError(
              `Failed to register template on-chain: ${registrationResult.error}`,
              500,
              'CHAIN_REGISTRATION_FAILED'
            );
          }
          
          // Store the deploy hash and queue background job for confirmation
          updateData.registrationDeployHash = registrationResult.deployHash;
          logger.info({ templateId: id, deployHash: registrationResult.deployHash }, 
            'Template registration deploy submitted');
          
          // Queue background job to check for confirmation - don't block the API response
          // This avoids timeout issues since blockchain confirmation can take 30-60+ seconds
          await addTemplateRegistrationJob(registrationResult.deployHash!, id);
          logger.info({ templateId: id, deployHash: registrationResult.deployHash }, 
            'Background job queued for template registration confirmation');
        }
        
        updateData.status = 'PUBLISHED';
        if (!existing.publishedAt) {
          updateData.publishedAt = new Date();
        }
      } else if (data.status) {
        updateData.status = data.status;
        if (data.status === 'ARCHIVED') {
          updateData.archivedAt = new Date();
        }
      }
      
      if (data.name) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;

      const workflow = await prisma.workflowTemplate.update({
        where: { id },
        data: updateData,
      });

      res.json({
        success: true,
        data: {
          ...workflow,
          // Convert BigInt to string for JSON serialization
          onChainWorkflowId: workflow.onChainWorkflowId?.toString() || null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Deactivate a workflow template.
 * Does not delete - preserves audit trail.
 * Requires ADMIN role.
 */
workflowsRouter.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const workflow = await prisma.workflowTemplate.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });

      res.json({
        success: true,
        data: workflow,
        message: 'Workflow template archived',
      });
    } catch (error) {
      next(error);
    }
  }
);
