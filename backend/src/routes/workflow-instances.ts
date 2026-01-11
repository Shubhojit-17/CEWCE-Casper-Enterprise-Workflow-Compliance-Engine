// =============================================================================
// Workflow Instance Routes
// =============================================================================
// Manage workflow instances (running workflows).
// =============================================================================

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { createError } from '../middleware/error-handler.js';
import { sha256Hex, sha256Bytes, hexToBytes } from '../lib/crypto.js';
import {
  submitDeploy,
  waitForDeploy,
  createWorkflowInstanceOnChain,
  isServerSigningAvailable,
} from '../lib/casper.js';
import { addSlaMonitorJob } from '../jobs/sla-monitor.js';
import { addInstanceRegistrationJob } from '../jobs/instance-registration.js';
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
          // Convert BigInt to string for JSON serialization
          workflowId: i.workflowId?.toString() || null,
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

    // Check for legacy template (PUBLISHED but no blockchain ID)
    // Return the data but flag it as legacy so frontend can show appropriate message
    const isLegacyTemplate = instance.template.status === 'PUBLISHED' && !instance.template.onChainWorkflowId;

    // Convert BigInt to string for JSON serialization
    const templateWithSerializedBigInt = {
      ...instance.template,
      onChainWorkflowId: instance.template.onChainWorkflowId?.toString() || null,
      isLegacy: isLegacyTemplate,
    };

    // Serialize BigInt fields in transitions (executionCost)
    // Note: 'any' cast needed because Prisma include types don't expose all fields in TypeScript
    const serializedTransitions = instance.transitions.map(t => {
      const transition = t as typeof t & { executionCost?: bigint | null };
      return {
        ...transition,
        executionCost: transition.executionCost?.toString() || null,
      };
    });

    res.json({
      success: true,
      data: {
        ...instance,
        // Convert instance workflowId BigInt to string
        workflowId: instance.workflowId?.toString() || null,
        template: templateWithSerializedBigInt,
        transitions: serializedTransitions,
        currentStateName,
        // Flag legacy instances that can't be transitioned
        isLegacy: isLegacyTemplate,
        legacyMessage: isLegacyTemplate 
          ? 'This workflow uses a template created before blockchain enforcement. Transitions are disabled.'
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a new workflow instance.
 * Uses server-side signing to create the workflow on-chain.
 * The workflow instance gets its own unique on-chain workflowId.
 */
workflowInstancesRouter.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createInstanceSchema.parse(req.body);
    
    // Support both templateId and workflowTemplateId
    const templateId = data.templateId || data.workflowTemplateId;
    
    if (!templateId) {
      throw createError('templateId is required', 400, 'VALIDATION_ERROR');
    }

    // Check if server-side signing is available
    if (!isServerSigningAvailable()) {
      throw createError(
        'Server-side signing not available. Contact administrator.',
        500,
        'SIGNING_UNAVAILABLE'
      );
    }

    // Verify template exists and is published
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template || template.status !== 'PUBLISHED') {
      throw createError('Workflow template not found or not published', 404, 'TEMPLATE_NOT_FOUND');
    }

    // CRITICAL: Reject legacy templates that were published before blockchain enforcement
    // These templates must be republished to get an onChainWorkflowId
    if (!template.onChainWorkflowId) {
      throw createError(
        'Template was created before blockchain enforcement and must be republished. ' +
        'Please archive this template and create a new one, or contact an administrator.',
        409,
        'LEGACY_TEMPLATE_NO_BLOCKCHAIN_ID'
      );
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

    // Create instance in database (status: PENDING - will get workflowId after confirmation)
    const instance = await prisma.workflowInstance.create({
      data: {
        orgId,
        templateId: template.id,
        title: data.title,
        description: data.description,
        data: JSON.parse(JSON.stringify(data.data || {})), // Ensure JSON-serializable
        currentState: initialState.id,
        status: 'PENDING', // Instance is pending until on-chain confirmation
        dueDate: data.slaDeadline ? new Date(data.slaDeadline) : null,
        creatorId: req.user!.userId,
      },
    });

    // Build hashes for on-chain registration
    // Use template ID + instance ID as unique reference
    const templateHashString = template.contractHash || sha256Hex(JSON.stringify(template.states));
    const templateHashBytes = hexToBytes(templateHashString);
    const dataHashBytes = sha256Bytes(JSON.stringify({
      instanceId: instance.id,
      templateId: template.id,
      data: data.data || {},
    }));

    // Submit create_workflow to blockchain using server-side signing
    const result = await createWorkflowInstanceOnChain(
      instance.id,
      templateHashBytes,
      dataHashBytes
    );

    if (!result.success || !result.deployHash) {
      // Delete the instance since we couldn't submit to blockchain
      await prisma.workflowInstance.delete({ where: { id: instance.id } });
      throw createError(
        result.error || 'Failed to submit workflow to blockchain',
        500,
        'BLOCKCHAIN_SUBMIT_FAILED'
      );
    }

    // Update instance with deploy hash
    await prisma.workflowInstance.update({
      where: { id: instance.id },
      data: { deployHash: result.deployHash },
    });

    // Record initial transition
    await prisma.workflowTransition.create({
      data: {
        instanceId: instance.id,
        fromState: 0, // Initial state
        toState: initialState.id,
        action: 'CREATE',
        actorId: req.user!.userId,
        deployHash: result.deployHash,
        status: 'PENDING',
      },
    });

    // Queue background job for confirmation polling and workflow ID extraction
    await addInstanceRegistrationJob(result.deployHash, instance.id, 1);

    // Schedule SLA monitoring if deadline set
    if (instance.dueDate) {
      await addSlaMonitorJob(instance.id, instance.dueDate);
    }

    logger.info({
      instanceId: instance.id,
      deployHash: result.deployHash,
      templateId: template.id,
      userId: req.user!.userId,
    }, 'Workflow instance creation submitted to blockchain');

    res.status(201).json({
      success: true,
      data: {
        instance: {
          ...instance,
          deployHash: result.deployHash,
        },
        deployHash: result.deployHash,
        explorerUrl: `https://testnet.cspr.live/deploy/${result.deployHash}`,
        message: 'Workflow instance submitted to blockchain. Waiting for confirmation.',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Submit a signed deploy for a workflow instance creation.
 * DEPRECATED: Instance creation now uses server-side signing.
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
 * ALL transitions are recorded on-chain using server-side signing.
 * No off-chain fallback - blockchain is mandatory.
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

      // Check for existing pending transitions to prevent duplicates
      const pendingTransition = await prisma.workflowTransition.findFirst({
        where: {
          instanceId: id,
          // Note: Using 'as any' because ONCHAIN_PENDING may not be in generated types yet
          status: { in: ['PENDING', 'ONCHAIN_PENDING'] as any },
        },
      });

      if (pendingTransition) {
        throw createError(
          'A transition is already pending. Please wait for it to complete.',
          400,
          'TRANSITION_PENDING'
        );
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

      // Verify instance has an on-chain workflow ID - REQUIRED for blockchain transitions
      // This is the instance's own workflow ID, not the template's
      const instanceWorkflowId = instance.workflowId;
      
      if (!instanceWorkflowId) {
        // Instance was created but doesn't have on-chain ID yet
        if (instance.status === 'PENDING' && instance.deployHash) {
          throw createError(
            'Workflow instance is still being confirmed on-chain. Please wait a moment and try again.',
            409,
            'INSTANCE_PENDING_CONFIRMATION'
          );
        }
        throw createError(
          'Workflow instance is not registered on-chain. This may be a legacy instance.',
          409,
          'INSTANCE_NOT_REGISTERED'
        );
      }

      // Import server-side signing functions
      const { 
        buildTransitionStateDeployServerSide, 
        signAndSubmitDeployServerSide,
        isServerSigningAvailable 
      } = await import('../lib/casper.js');

      if (!isServerSigningAvailable()) {
        throw createError(
          'Server-side signing not available. Contact administrator.',
          500,
          'SIGNING_UNAVAILABLE'
        );
      }

      // Build server-side transition deploy using deployer key
      const roleMask = await getUserRoleMask(req.user!.userId);
      const commentHash = comment ? sha256Bytes(comment) : new Uint8Array(32);

      const deploy = buildTransitionStateDeployServerSide(
        instanceWorkflowId.toString(),
        toState,
        roleMask,
        commentHash
      );

      if (!deploy) {
        throw createError(
          'Failed to build transition deploy',
          500,
          'DEPLOY_BUILD_FAILED'
        );
      }

      // Sign and submit deploy using server deployer key
      const deployHash = await signAndSubmitDeployServerSide(deploy);

      if (!deployHash) {
        throw createError(
          'Failed to submit deploy to Casper network',
          500,
          'DEPLOY_SUBMIT_FAILED'
        );
      }

      logger.info({ 
        instanceId: id, 
        deployHash, 
        fromState: instance.currentState, 
        toState,
        instanceWorkflowId: instanceWorkflowId.toString()
      }, 'Transition deploy submitted to Casper network');

      // Create transition record with ONCHAIN_PENDING status
      const transition = await prisma.workflowTransition.create({
        data: {
          instanceId: id,
          fromState: instance.currentState,
          toState,
          action: 'TRANSITION',
          actorId: req.user!.userId,
          comment,
          deployHash,
          // Note: Using 'as any' because ONCHAIN_PENDING may not be in generated types yet
          status: 'ONCHAIN_PENDING' as any,
        },
      });

      // Queue background job for confirmation polling
      const { addDeployConfirmationJob } = await import('../jobs/deploy-confirmation.js');
      await addDeployConfirmationJob(
        deployHash,
        transition.id,
        id,
        toState,
        0 // initial attempt
      );

      // Return immediately with deploy hash - confirmation is async
      res.json({
        success: true,
        data: {
          instanceId: id,
          transitionId: transition.id,
          fromState: instance.currentState,
          toState,
          deployHash,
          status: 'ONCHAIN_PENDING',
          explorerUrl: `https://testnet.cspr.live/deploy/${deployHash}`,
          message: 'Transition submitted to Casper network. Waiting for confirmation.',
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
 * Cancel a pending transition.
 */
workflowInstancesRouter.post(
  '/:id/transition/:transitionId/cancel',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, transitionId } = req.params;

      const instance = await prisma.workflowInstance.findUnique({
        where: { id },
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
        throw createError('Only pending transitions can be cancelled', 400, 'INVALID_STATUS');
      }

      // Update transition status to CANCELLED
      await prisma.workflowTransition.update({
        where: { id: transitionId },
        data: {
          status: 'FAILED',
          error: 'Cancelled by user',
        },
      });

      res.json({
        success: true,
        data: {
          instanceId: id,
          transitionId,
          message: 'Transition cancelled successfully',
        },
      });
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

      // Legacy templates cannot have transitions
      if (instance.template.status === 'PUBLISHED' && !instance.template.onChainWorkflowId) {
        res.json({
          success: true,
          data: {
            transitions: [],
            message: 'Legacy template - transitions disabled. Template must be republished.',
            isLegacy: true,
          },
        });
        return;
      }

      // Instance without on-chain workflowId cannot transition
      if (!instance.workflowId) {
        // Check if instance is still pending confirmation
        if (instance.status === 'PENDING' && instance.deployHash) {
          res.json({
            success: true,
            data: {
              transitions: [],
              message: 'Instance is pending blockchain confirmation. Please wait.',
              isPending: true,
            },
          });
          return;
        }
        // Legacy instance without workflowId
        res.json({
          success: true,
          data: {
            transitions: [],
            message: 'Legacy instance - transitions disabled. Create a new workflow instance.',
            isLegacy: true,
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
// =============================================================================
// Document Management
// =============================================================================

/**
 * Get documents for a workflow instance.
 */
workflowInstancesRouter.get(
  '/:id/documents',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const instance = await prisma.workflowInstance.findFirst({
        where: { id },
        include: { organization: true },
      });

      if (!instance) {
        throw createError('Workflow instance not found', 404, 'NOT_FOUND');
      }

      const documents = await prisma.workflowDocument.findMany({
        where: { instanceId: id },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: { documents },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Upload a document to a workflow instance.
 * Uses base64 encoding for simplicity (no external storage required).
 */
workflowInstancesRouter.post(
  '/:id/documents',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { name, mimeType, content } = req.body;

      if (!name || !mimeType || !content) {
        throw createError('name, mimeType, and content are required', 400, 'VALIDATION_ERROR');
      }

      const instance = await prisma.workflowInstance.findFirst({
        where: { id },
      });

      if (!instance) {
        throw createError('Workflow instance not found', 404, 'NOT_FOUND');
      }

      // Decode base64 to calculate size and checksum
      const buffer = Buffer.from(content, 'base64');
      const size = buffer.length;
      
      // Max 10MB
      if (size > 10 * 1024 * 1024) {
        throw createError('File too large. Maximum size is 10MB.', 400, 'FILE_TOO_LARGE');
      }

      // Calculate SHA-256 checksum
      const crypto = await import('crypto');
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

      // Store the content as base64 in the storageKey field (simple approach)
      const document = await prisma.workflowDocument.create({
        data: {
          instanceId: id,
          uploaderId: req.user!.userId,
          name,
          mimeType,
          size,
          storageKey: content, // Store base64 content directly
          checksum,
        },
      });

      // Log the upload
      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'DOCUMENT_UPLOAD',
          resource: 'document',
          resourceId: document.id,
          details: {
            workflowInstanceId: id,
            documentName: name,
            mimeType,
            size,
            checksum,
          },
        },
      });

      res.status(201).json({
        success: true,
        data: {
          document: {
            id: document.id,
            name: document.name,
            mimeType: document.mimeType,
            size: document.size,
            checksum: document.checksum,
            createdAt: document.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Download a document.
 */
workflowInstancesRouter.get(
  '/:id/documents/:documentId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, documentId } = req.params;

      const document = await prisma.workflowDocument.findFirst({
        where: { id: documentId, instanceId: id },
      });

      if (!document) {
        throw createError('Document not found', 404, 'NOT_FOUND');
      }

      res.json({
        success: true,
        data: {
          document: {
            id: document.id,
            name: document.name,
            mimeType: document.mimeType,
            size: document.size,
            checksum: document.checksum,
            content: document.storageKey, // Return base64 content
            createdAt: document.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete a document.
 */
workflowInstancesRouter.delete(
  '/:id/documents/:documentId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, documentId } = req.params;

      const document = await prisma.workflowDocument.findFirst({
        where: { id: documentId, instanceId: id },
      });

      if (!document) {
        throw createError('Document not found', 404, 'NOT_FOUND');
      }

      await prisma.workflowDocument.delete({
        where: { id: documentId },
      });

      // Log the deletion
      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'DOCUMENT_DELETE',
          resource: 'document',
          resourceId: documentId,
          details: {
            workflowInstanceId: id,
            documentName: document.name,
          },
        },
      });

      res.json({
        success: true,
        data: { message: 'Document deleted successfully' },
      });
    } catch (error) {
      next(error);
    }
  }
);