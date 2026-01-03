// =============================================================================
// Workflow Instance Routes
// =============================================================================
// Manage workflow instances (running workflows).
// =============================================================================

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import CasperSDK from 'casper-js-sdk';
const { DeployUtil } = CasperSDK;
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { createError } from '../middleware/error-handler.js';
import { sha256Hex, sha256Bytes, hexToBytes } from '../lib/crypto.js';
import {
  buildCreateWorkflowDeploy,
  buildTransitionStateDeploy,
  submitDeploy,
  waitForDeploy,
} from '../lib/casper.js';
import { addSlaMonitorJob } from '../jobs/sla-monitor.js';
import { logger } from '../lib/logger.js';

export const workflowInstancesRouter = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const createInstanceSchema = z.object({
  templateId: z.string().optional(),
  workflowTemplateId: z.string().optional(),
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  data: z.record(z.unknown()).optional().default({}),
  slaDeadline: z.string().optional().nullable(),
});

const transitionStateSchema = z.object({
  toState: z.number().int().min(0).max(255),
  comment: z.string().optional(),
  signedDeploy: z.unknown(), // Signed deploy JSON from wallet
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get role bitmask for a user.
 */
async function getUserRoleMask(userId: string): Promise<bigint> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  });

  // Map role names to bit positions
  const roleBits: Record<string, number> = {
    REQUESTER: 0,
    APPROVER: 1,
    SENIOR_APPROVER: 2,
    ADMIN: 3,
    AUDITOR: 4,
  };

  let mask = 0n;
  for (const ur of userRoles) {
    const bit = roleBits[ur.role.name];
    if (bit !== undefined) {
      mask |= 1n << BigInt(bit);
    }
  }

  return mask;
}

/**
 * Check if user has permission for a state transition.
 */
async function canTransition(
  userId: string,
  workflowTemplateId: string,
  fromState: number,
  toState: number
): Promise<boolean> {
  const [user, template] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    }),
    prisma.workflowTemplate.findUnique({
      where: { id: workflowTemplateId },
    }),
  ]);

  if (!user || !template) return false;

  const userRoles = new Set(user.roles.map(r => r.role.name));
  const transitions = template.transitions as Array<{
    fromState: number;
    toState: number;
    requiredRoles: string[];
  }>;

  const transition = transitions.find(
    t => t.fromState === fromState && t.toState === toState
  );

  if (!transition) return false;

  return transition.requiredRoles.some(role => userRoles.has(role));
}

// =============================================================================
// Routes
// =============================================================================

/**
 * List workflow instances.
 */
workflowInstancesRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      templateId,
      createdBy,
      assignedTo,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (templateId) where.templateId = templateId;
    if (createdBy) where.creatorId = createdBy;

    // Filter by assigned (pending task for user)
    // This queries instances where the user can perform the next transition
    if (assignedTo === 'me') {
      // Get user's roles for future sophisticated assignment logic
      await prisma.userRole.findMany({
        where: { userId: req.user!.userId },
        include: { role: true },
      });

      // This is a simplified filter - production would use more sophisticated assignment logic
      where.status = 'PENDING';
    }

    const [instances, total] = await Promise.all([
      prisma.workflowInstance.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          template: {
            select: { id: true, name: true, version: true },
          },
          creator: {
            select: { id: true, publicKey: true, displayName: true },
          },
          _count: {
            select: { transitions: true },
          },
        },
      }),
      prisma.workflowInstance.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        instances: instances.map(i => ({
          ...i,
          transitionCount: i._count.transitions,
          _count: undefined,
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
});

/**
 * Get a specific workflow instance with full history.
 */
workflowInstancesRouter.get('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const instance = await prisma.workflowInstance.findUnique({
      where: { id },
      include: {
        template: true,
        creator: {
          select: { id: true, publicKey: true, displayName: true },
        },
        transitions: {
          orderBy: { createdAt: 'asc' },
          include: {
            actor: {
              select: { id: true, publicKey: true, displayName: true },
            },
          },
        },
      },
    });

    if (!instance) {
      throw createError('Workflow instance not found', 404, 'NOT_FOUND');
    }

    // Parse states from template for display
    const states = instance.template.states as Array<{ id: number; name: string }>;
    const currentStateName = states.find(s => s.id === instance.currentState)?.name || 'Unknown';

    res.json({
      success: true,
      data: {
        ...instance,
        currentStateName,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a new workflow instance.
 * Returns an unsigned deploy for the user to sign.
 */
workflowInstancesRouter.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createInstanceSchema.parse(req.body);
    
    // Support both templateId and workflowTemplateId
    const templateId = data.templateId || data.workflowTemplateId;
    
    if (!templateId) {
      throw createError('templateId is required', 400, 'VALIDATION_ERROR');
    }

    // Verify template exists and is published
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || template.status !== 'PUBLISHED') {
      throw createError('Workflow template not found or not published', 404, 'TEMPLATE_NOT_FOUND');
    }

    // Get initial state
    const states = template.states as Array<{ id: number; isInitial: boolean }>;
    const initialState = states.find(s => s.isInitial);

    if (!initialState) {
      throw createError('Template has no initial state', 400, 'INVALID_TEMPLATE');
    }

    // Get user's organization (use first org membership for now)
    const orgUser = await prisma.organizationUser.findFirst({
      where: { userId: req.user!.userId },
    });
    const orgId = orgUser?.orgId || template.orgId;

    // Create instance in database (status: DRAFT until blockchain confirmation)
    const instance = await prisma.workflowInstance.create({
      data: {
        orgId,
        templateId: template.id,
        title: data.title,
        description: data.description,
        data: JSON.parse(JSON.stringify(data.data || {})), // Ensure JSON-serializable
        currentState: initialState.id,
        status: 'DRAFT',
        dueDate: data.slaDeadline ? new Date(data.slaDeadline) : null,
        creatorId: req.user!.userId,
      },
    });

    // Build unsigned deploy for blockchain
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check if user has a wallet connected - if not, skip blockchain recording
    if (!user.publicKey) {
      logger.warn('User has no wallet connected. Instance created without blockchain record.');
      
      res.status(201).json({
        success: true,
        data: {
          instance,
          deploy: null,
          message: 'Workflow instance created. Connect a Casper wallet to record on blockchain.',
        },
      });
      return;
    }

    // Use template metadata or contract hash for on-chain reference
    const templateHashString = template.contractHash || sha256Hex(JSON.stringify(template.states));
    const templateHashBytes = hexToBytes(templateHashString);
    const dataHashBytes = sha256Bytes(JSON.stringify(data.data || {}));

    const deploy = buildCreateWorkflowDeploy(
      user.publicKey,
      templateHashBytes,
      dataHashBytes
    );

    if (!deploy) {
      // Contract not configured - return instance without blockchain deploy
      logger.warn('Contract not configured. Instance created without blockchain record.');
      
      res.status(201).json({
        success: true,
        data: {
          instance,
          deploy: null,
          message: 'Instance created. Blockchain recording unavailable (contract not configured).',
        },
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: {
        instance,
        deploy: DeployUtil.deployToJson(deploy),
        message: 'Sign the deploy with your wallet and submit to /workflow-instances/:id/submit',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Submit a signed deploy for a workflow instance creation.
 */
workflowInstancesRouter.post(
  '/:id/submit',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { signedDeploy } = req.body;

      if (!signedDeploy) {
        throw createError('signedDeploy is required', 400, 'MISSING_SIGNED_DEPLOY');
      }

      const instance = await prisma.workflowInstance.findUnique({
        where: { id },
      });

      if (!instance) {
        throw createError('Workflow instance not found', 404, 'NOT_FOUND');
      }

      if (instance.status !== 'DRAFT') {
        throw createError('Instance already submitted', 400, 'ALREADY_SUBMITTED');
      }

      // Submit deploy to Casper network
      const deployHash = await submitDeploy(signedDeploy);

      // Update instance with deploy hash
      await prisma.workflowInstance.update({
        where: { id },
        data: {
          status: 'PENDING',
          deployHash,
        },
      });

      // Record initial transition
      await prisma.workflowTransition.create({
        data: {
          instanceId: id,
          fromState: 0, // Initial state
          toState: instance.currentState,
          action: 'CREATE',
          actorId: req.user!.userId,
          deployHash,
          status: 'PENDING',
        },
      });

      // Schedule SLA monitoring if deadline set
      if (instance.dueDate) {
        await addSlaMonitorJob(id, instance.dueDate);
      }

      res.json({
        success: true,
        data: {
          instanceId: id,
          deployHash,
          message: 'Deploy submitted. Waiting for confirmation.',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Transition workflow state.
 * Returns an unsigned deploy for approval/rejection.
 */
workflowInstancesRouter.post(
  '/:id/transition',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { toState, comment } = transitionStateSchema.parse(req.body);

      const instance = await prisma.workflowInstance.findUnique({
        where: { id },
        include: { template: true },
      });

      if (!instance) {
        throw createError('Workflow instance not found', 404, 'NOT_FOUND');
      }

      if (instance.status === 'COMPLETED') {
        throw createError('Workflow already completed', 400, 'WORKFLOW_COMPLETED');
      }

      // Check permission
      const canPerform = await canTransition(
        req.user!.userId,
        instance.templateId,
        instance.currentState,
        toState
      );

      if (!canPerform) {
        throw createError('You do not have permission for this transition', 403, 'FORBIDDEN');
      }

      // Get user for deploy
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
      });

      if (!user) {
        throw createError('User not found', 404, 'USER_NOT_FOUND');
      }

      const roleMask = await getUserRoleMask(req.user!.userId);
      const commentHash = comment ? sha256Bytes(comment) : new Uint8Array(32);

      // Build unsigned deploy
      const deploy = buildTransitionStateDeploy(
        user.publicKey || '',
        instance.workflowId?.toString() || '0',
        toState,
        roleMask,
        commentHash
      );

      if (!deploy) {
        // Contract not configured - perform off-chain transition only
        logger.warn('Contract not configured. Transition recorded off-chain only.');

        // Update instance
        const states = instance.template.states as Array<{ id: number; isTerminal: boolean }>;
        const isTerminal = states.find(s => s.id === toState)?.isTerminal || false;

        await prisma.$transaction([
          prisma.workflowInstance.update({
            where: { id },
            data: {
              currentState: toState,
              status: isTerminal ? 'COMPLETED' : 'PENDING',
            },
          }),
          prisma.workflowTransition.create({
            data: {
              instanceId: id,
              fromState: instance.currentState,
              toState,
              action: 'TRANSITION',
              actorId: req.user!.userId,
              comment,
              status: 'CONFIRMED',
            },
          }),
        ]);

        res.json({
          success: true,
          data: {
            instanceId: id,
            fromState: instance.currentState,
            toState,
            deploy: null,
            message: 'Transition recorded (off-chain only - contract not configured)',
          },
        });
        return;
      }

      // Create pending transition record
      const transition = await prisma.workflowTransition.create({
        data: {
          instanceId: id,
          fromState: instance.currentState,
          toState,
          action: 'TRANSITION',
          actorId: req.user!.userId,
          comment,
          status: 'PENDING',
        },
      });

      res.json({
        success: true,
        data: {
          instanceId: id,
          transitionId: transition.id,
          fromState: instance.currentState,
          toState,
          deploy: DeployUtil.deployToJson(deploy),
          message: 'Sign the deploy with your wallet and submit to /workflow-instances/:id/transition/submit',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Submit a signed transition deploy.
 */
workflowInstancesRouter.post(
  '/:id/transition/submit',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { transitionId, signedDeploy } = req.body;

      if (!signedDeploy) {
        throw createError('signedDeploy is required', 400, 'MISSING_SIGNED_DEPLOY');
      }

      const instance = await prisma.workflowInstance.findUnique({
        where: { id },
        include: { template: true },
      });

      if (!instance) {
        throw createError('Workflow instance not found', 404, 'NOT_FOUND');
      }

      const transition = await prisma.workflowTransition.findUnique({
        where: { id: transitionId },
      });

      if (!transition || transition.instanceId !== id) {
        throw createError('Transition not found', 404, 'TRANSITION_NOT_FOUND');
      }

      if (transition.status !== 'PENDING') {
        throw createError('Transition already processed', 400, 'ALREADY_PROCESSED');
      }

      // Submit deploy
      const deployHash = await submitDeploy(signedDeploy);

      // Update transition with deploy hash
      await prisma.workflowTransition.update({
        where: { id: transitionId },
        data: {
          deployHash,
          // Status remains PENDING until confirmation
        },
      });

      // Deploy confirmation via RPC polling (RPC-only mode)
      // Uses get-deploy to poll until finality is reached

      // For now, we'll wait for confirmation synchronously (simplified)
      try {
        const result = await waitForDeploy(deployHash, 60000);
        
        // Check if execution succeeded
        const execResult = result as { Success?: unknown; Failure?: { error_message: string } };
        
        if (execResult.Failure) {
          await prisma.workflowTransition.update({
            where: { id: transitionId },
            data: {
              status: 'FAILED',
              error: execResult.Failure.error_message,
            },
          });

          throw createError(
            `Deploy failed: ${execResult.Failure.error_message}`,
            400,
            'DEPLOY_FAILED'
          );
        }

        // Update instance state
        const states = instance.template.states as Array<{ id: number; isTerminal: boolean }>;
        const isTerminal = states.find(s => s.id === transition.toState)?.isTerminal || false;

        await prisma.$transaction([
          prisma.workflowInstance.update({
            where: { id },
            data: {
              currentState: transition.toState,
              status: isTerminal ? 'COMPLETED' : 'PENDING',
            },
          }),
          prisma.workflowTransition.update({
            where: { id: transitionId },
            data: { status: 'CONFIRMED' },
          }),
        ]);

        res.json({
          success: true,
          data: {
            instanceId: id,
            transitionId,
            deployHash,
            status: 'CONFIRMED',
            newState: transition.toState,
            isCompleted: isTerminal,
          },
        });
      } catch (waitError) {
        // Deploy not confirmed in time - mark as submitted
        // Background job will reconcile later
        res.json({
          success: true,
          data: {
            instanceId: id,
            transitionId,
            deployHash,
            status: 'SUBMITTED',
            message: 'Deploy submitted. State will be updated on confirmation.',
          },
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get available transitions for current user on an instance.
 */
workflowInstancesRouter.get(
  '/:id/available-transitions',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const instance = await prisma.workflowInstance.findUnique({
        where: { id },
        include: { template: true },
      });

      if (!instance) {
        throw createError('Workflow instance not found', 404, 'NOT_FOUND');
      }

      if (instance.status === 'COMPLETED') {
        res.json({
          success: true,
          data: {
            transitions: [],
            message: 'Workflow is completed',
          },
        });
        return;
      }

      // Get user roles
      const userRoles = await prisma.userRole.findMany({
        where: { userId: req.user!.userId },
        include: { role: true },
      });
      const roleNames = new Set(userRoles.map(r => r.role.name));

      // Filter available transitions
      const transitions = instance.template.transitions as Array<{
        fromState: number;
        toState: number;
        name: string;
        requiredRoles: string[];
      }>;

      const states = instance.template.states as Array<{ id: number; name: string }>;

      const available = transitions
        .filter(t => t.fromState === instance.currentState)
        .filter(t => t.requiredRoles.some(r => roleNames.has(r)))
        .map(t => ({
          ...t,
          toStateName: states.find(s => s.id === t.toState)?.name || 'Unknown',
        }));

      res.json({
        success: true,
        data: {
          currentState: instance.currentState,
          currentStateName: states.find(s => s.id === instance.currentState)?.name || 'Unknown',
          transitions: available,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);
