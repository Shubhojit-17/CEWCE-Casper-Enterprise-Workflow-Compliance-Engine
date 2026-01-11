// =============================================================================
// Workflow Instance Routes
// =============================================================================
// Manage workflow instances (running workflows).
// =============================================================================

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, blockCustomerRole, requireManagerOrAdmin } from '../middleware/auth.js';
import { createError } from '../middleware/error-handler.js';
import { sha256Hex, sha256Bytes, hexToBytes } from '../lib/crypto.js';
import {
  submitDeploy,
  waitForDeploy,
  isServerSigningAvailable,
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
  assignedCustomerId: z.string().optional().nullable(), // Customer to assign at creation
  assignedApproverId: z.string().optional().nullable(), // Approver to assign at creation
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
// Role-Based Visibility Scoping
// =============================================================================

/**
 * Build a Prisma `where` clause that scopes workflow visibility based on user roles.
 * 
 * VISIBILITY RULES (AUTHORITATIVE):
 * - CUSTOMER: Only workflows where assignedCustomerId === userId
 * - REQUESTER/USER: Only workflows they created (creatorId === userId)
 * - APPROVER: Only workflows assigned to them (assignedApproverId === userId)
 * - MANAGER: All workflows in their organization
 * - ADMIN: All workflows in their organization
 * - AUDITOR: All workflows in their organization (read-only)
 * 
 * Multiple roles combine with OR logic (most permissive wins).
 */
async function buildVisibilityScope(
  userId: string,
  userRoles: string[],
  orgId?: string
): Promise<Record<string, unknown>> {
  // ADMIN, AUDITOR, MANAGER, APPROVER: Full organization visibility
  // APPROVER needs org-wide visibility to filter by user/customer
  if (userRoles.some(r => ['ADMIN', 'AUDITOR', 'MANAGER', 'APPROVER', 'SENIOR_APPROVER'].includes(r))) {
    // If org context available, scope to org; otherwise no additional filter
    if (orgId) {
      return { orgId };
    }
    // Get user's organizations for scoping
    const userOrgs = await prisma.organizationUser.findMany({
      where: { userId },
      select: { orgId: true },
    });
    if (userOrgs.length > 0) {
      return { orgId: { in: userOrgs.map(o => o.orgId) } };
    }
    return {}; // No org restriction
  }

  // Build OR conditions for non-admin roles
  const orConditions: Array<Record<string, unknown>> = [];

  // APPROVER: Can see workflows assigned to them
  if (userRoles.some(r => ['APPROVER', 'SENIOR_APPROVER'].includes(r))) {
    orConditions.push({ assignedApproverId: userId });
  }

  // REQUESTER / USER: Can see workflows they created
  if (userRoles.some(r => ['REQUESTER', 'USER'].includes(r))) {
    orConditions.push({ creatorId: userId });
  }

  // CUSTOMER: Can see only workflows assigned to them
  if (userRoles.includes('CUSTOMER')) {
    orConditions.push({ assignedCustomerId: userId });
  }

  // USER role: Also see workflows assigned to them as customer
  // (A USER can be assigned as a customer even without CUSTOMER role)
  if (userRoles.includes('USER')) {
    orConditions.push({ assignedCustomerId: userId });
  }

  // If no conditions built (shouldn't happen), return impossible condition
  if (orConditions.length === 0) {
    logger.warn({ userId, userRoles }, 'User has no visibility-granting roles');
    return { id: '__NONE__' }; // Matches nothing
  }

  // Combine with OR
  return { OR: orConditions };
}

/**
 * Check if a user can view a specific workflow instance.
 * Returns true if allowed, false otherwise.
 */
async function canViewWorkflow(
  userId: string,
  userRoles: string[],
  instance: { 
    id: string; 
    orgId: string; 
    creatorId: string; 
    assignedCustomerId: string | null; 
    assignedApproverId: string | null 
  }
): Promise<boolean> {
  // ADMIN, AUDITOR, MANAGER, APPROVER: Can view all in their orgs
  if (userRoles.some(r => ['ADMIN', 'AUDITOR', 'MANAGER', 'APPROVER', 'SENIOR_APPROVER'].includes(r))) {
    // Check org membership
    const orgMembership = await prisma.organizationUser.findFirst({
      where: { userId, orgId: instance.orgId },
    });
    return !!orgMembership;
  }

  // REQUESTER / USER: Can view if they created it OR if they are assigned customer
  if (userRoles.some(r => ['REQUESTER', 'USER'].includes(r))) {
    if (instance.creatorId === userId) return true;
    if (instance.assignedCustomerId === userId) return true;
  }

  // CUSTOMER: Can view only if assigned to them
  if (userRoles.includes('CUSTOMER')) {
    if (instance.assignedCustomerId === userId) return true;
  }

  return false;
}

/**
 * Check if a user can upload/delete documents on a specific workflow.
 * 
 * DOCUMENT PERMISSION RULES:
 * - Assigned customer: CAN upload/delete
 * - Requester (creator): CAN upload/delete
 * - Manager/Admin: CAN upload/delete
 * - Approver: CANNOT (view-only)
 * - Others: CANNOT
 */
function canModifyDocuments(
  userId: string,
  userRoles: string[],
  instance: {
    creatorId: string;
    assignedCustomerId: string | null;
  }
): boolean {
  // Manager/Admin: Can always modify documents
  if (userRoles.some(r => ['ADMIN', 'MANAGER'].includes(r))) {
    return true;
  }

  // Requester (creator): Can modify documents on their own workflows
  if (instance.creatorId === userId) {
    return true;
  }

  // Assigned customer: Can modify documents on their assigned workflows
  if (instance.assignedCustomerId === userId) {
    return true;
  }

  // Approvers and others: View-only, no document modifications
  return false;
}

// =============================================================================
// Routes
// =============================================================================

/**
 * List workflow instances.
 * 
 * VISIBILITY ENFORCEMENT:
 * Results are automatically scoped based on user role:
 * - CUSTOMER: Only workflows assigned to them (assignedCustomerId)
 * - REQUESTER/USER: Only workflows they created (creatorId)
 * - APPROVER: Only workflows assigned to them (assignedApproverId)
 * - MANAGER/ADMIN/AUDITOR: All workflows in their organization
 * 
 * Additional filters (status, templateId, etc.) are applied on top of visibility scope.
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
      customerId,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    // CRITICAL: Build visibility-scoped base query
    // This ensures users ONLY see workflows they have permission to view
    const visibilityScope = await buildVisibilityScope(
      req.user!.userId,
      req.user!.roles
    );

    // Start with visibility scope as base
    const where: Record<string, unknown> = { ...visibilityScope };

    // Apply additional filters on top of visibility scope
    if (status) where.status = status;
    if (templateId) where.templateId = templateId;
    
    // customerId filter: Allow approvers/managers/admins to filter by assigned customer
    if (customerId) {
      const canFilterByCustomer = req.user!.roles.some((r: string) => 
        ['ADMIN', 'MANAGER', 'APPROVER', 'SENIOR_APPROVER', 'AUDITOR'].includes(r)
      );
      if (canFilterByCustomer) {
        where.assignedCustomerId = customerId;
      }
    }
    
    // createdBy filter: Only admins/managers can filter by other users' creations
    if (createdBy) {
      const canFilterByOthers = req.user!.roles.some((r: string) => 
        ['ADMIN', 'MANAGER', 'AUDITOR'].includes(r)
      );
      if (canFilterByOthers || createdBy === req.user!.userId) {
        where.creatorId = createdBy;
      }
      // If non-admin tries to filter by others, silently ignore (visibility scope already limits)
    }

    // Filter by assigned (pending task for user)
    if (assignedTo === 'me') {
      // Add assignedApproverId filter for approvers
      if (req.user!.roles.some((r: string) => ['APPROVER', 'SENIOR_APPROVER'].includes(r))) {
        where.assignedApproverId = req.user!.userId;
      }
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
 * 
 * VISIBILITY ENFORCEMENT:
 * Access is checked against user role and relationship to the workflow.
 * Returns 403 Forbidden if user cannot view this workflow.
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
        assignedCustomer: {
          select: { id: true, displayName: true, email: true },
        },
        assignedApprover: {
          select: { id: true, displayName: true, email: true },
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

    // VISIBILITY ENFORCEMENT: Check if user can view this workflow
    const canView = await canViewWorkflow(
      req.user!.userId,
      req.user!.roles,
      {
        id: instance.id,
        orgId: instance.orgId,
        creatorId: instance.creatorId,
        assignedCustomerId: instance.assignedCustomerId,
        assignedApproverId: instance.assignedApproverId,
      }
    );

    if (!canView) {
      throw createError(
        'Access denied. You do not have permission to view this workflow.',
        403,
        'FORBIDDEN'
      );
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

    // =======================================================================
    // Compute action flags for frontend UI
    // =======================================================================
    const isCreator = instance.creatorId === req.user!.userId;
    const isApprover = req.user!.roles.some((r: string) => 
      ['APPROVER', 'SENIOR_APPROVER', 'MANAGER', 'ADMIN'].includes(r)
    );

    // Is this workflow on the blockchain?
    const isOnChain = Boolean(instance.workflowId);
    
    // Is this workflow pending approver review?
    const isPendingApproval = instance.status === 'CUSTOMER_CONFIRMED';

    // Can this user approve/reject this workflow?
    // Must be: CUSTOMER_CONFIRMED status AND (assigned approver OR general approver)
    const canApprove = isPendingApproval && isApprover;
    
    // Can this user confirm as customer?
    const isAssignedCustomer = instance.assignedCustomerId === req.user!.userId;
    const canConfirmAsCustomer = 
      isAssignedCustomer && 
      instance.status === 'PENDING_CUSTOMER_CONFIRMATION';

    // Can this user resubmit a rejected workflow?
    // Must be: REJECTED status AND not on-chain AND (creator OR assigned customer)
    const canResubmit = 
      instance.status === 'REJECTED' && 
      !isOnChain && 
      (isCreator || isAssignedCustomer);

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
        // NEW flags for the corrected business flow
        isOnChain,           // Is workflow registered on blockchain?
        isPendingApproval,   // Awaiting approver review?
        canApprove,          // Can current user approve/reject?
        canConfirmAsCustomer,// Can current user confirm as customer?
        isCreator,           // Is current user the creator?
        canResubmit,         // Can current user resubmit this rejected workflow?
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

    // Validate customer assignment if provided
    let validatedCustomerId: string | null = null;
    if (data.assignedCustomerId) {
      const customer = await prisma.user.findUnique({
        where: { id: data.assignedCustomerId },
        include: { roles: { include: { role: true } } },
      });

      if (!customer) {
        throw createError('Assigned customer not found', 404, 'CUSTOMER_NOT_FOUND');
      }

      // Verify user has CUSTOMER role (or is a regular user being treated as customer)
      const hasCustomerRole = customer.roles.some(r => 
        ['CUSTOMER', 'USER'].includes(r.role.name)
      );
      if (!hasCustomerRole) {
        throw createError(
          'Assigned user does not have customer permissions',
          400,
          'NOT_A_CUSTOMER'
        );
      }

      validatedCustomerId = data.assignedCustomerId;
    }

    // =========================================================================
    // NEW FLOW: All workflows start as DRAFT (off-chain)
    // =========================================================================
    // - With customer: PENDING_CUSTOMER_CONFIRMATION → CUSTOMER_CONFIRMED → submit-to-chain → ACTIVE
    // - Without customer: DRAFT → submit-to-chain → ACTIVE (not yet implemented for no-customer flow)
    // 
    // For now, we require customer assignment for proper workflow flow.
    // Workflows without customer will still use PENDING_CUSTOMER_CONFIRMATION
    // until the full flow is implemented.
    const initialStatus = validatedCustomerId 
      ? 'PENDING_CUSTOMER_CONFIRMATION' 
      : 'DRAFT';

    // Create instance in database (OFF-CHAIN ONLY - no blockchain interaction)
    const instance = await prisma.workflowInstance.create({
      data: {
        orgId,
        templateId: template.id,
        title: data.title,
        description: data.description,
        data: JSON.parse(JSON.stringify(data.data || {})), // Ensure JSON-serializable
        currentState: initialState.id,
        status: initialStatus,
        dueDate: data.slaDeadline ? new Date(data.slaDeadline) : null,
        creatorId: req.user!.userId,
        assignedCustomerId: validatedCustomerId,
        assignedApproverId: data.assignedApproverId || null,
      },
    });

    // Create initial transition record for workflow creation
    await prisma.workflowTransition.create({
      data: {
        instanceId: instance.id,
        fromState: 0,
        toState: initialState.id,
        action: 'CREATE',
        actorId: req.user!.userId,
        comment: validatedCustomerId 
          ? `Workflow created and assigned to customer for confirmation` 
          : 'Workflow created as draft',
        status: 'CONFIRMED', // Off-chain creation is immediately confirmed
      },
    });

    // Audit log for workflow creation
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: validatedCustomerId ? 'WORKFLOW_CREATED_WITH_CUSTOMER' : 'WORKFLOW_CREATED',
        resource: 'workflow_instance',
        resourceId: instance.id,
        details: {
          templateId: template.id,
          templateName: template.name,
          customerId: validatedCustomerId,
          status: initialStatus,
          note: 'Workflow created OFF-CHAIN. No blockchain interaction yet.',
        },
      },
    });

    logger.info({
      instanceId: instance.id,
      customerId: validatedCustomerId,
      templateId: template.id,
      userId: req.user!.userId,
      status: initialStatus,
    }, 'Workflow instance created (OFF-CHAIN). Awaiting customer confirmation and requester blockchain submission.');

    res.status(201).json({
      success: true,
      data: {
        instance: {
          ...instance,
          workflowId: null,
        },
        message: validatedCustomerId 
          ? 'Workflow created. Awaiting customer confirmation before blockchain registration.'
          : 'Workflow created as draft. Submit to blockchain when ready.',
        status: initialStatus,
        requiresCustomerConfirmation: !!validatedCustomerId,
        requiresBlockchainSubmission: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =============================================================================
// Submit to Blockchain (Requester Action)
// =============================================================================

/**
 * Submit workflow to blockchain for on-chain registration.
 * 
 * BUSINESS RULES:
 * - Only the creator (requester) can submit
 * - Workflow must be in CUSTOMER_CONFIRMED or DRAFT status
 * - Workflow must NOT already be on-chain (no onChainWorkflowId)
 * 
 * FLOW:
 * 1. Validates requester permission and workflow status
 * 2. Builds create_workflow deploy with template and data hashes
 * 3. Submits to Casper blockchain
// =============================================================================
// DEPRECATED: submit-to-chain endpoint
// =============================================================================
// This endpoint is DISABLED. Blockchain registration now happens automatically
// when an APPROVER approves a CUSTOMER_CONFIRMED workflow via the /transition endpoint.
//
// Old flow: Create → Customer Confirm → Requester Submit to Chain → Approver Approve
// New flow: Create → Customer Confirm → Approver Approve (blockchain here) → ACTIVE
//
// The transition endpoint handles:
// - APPROVAL of CUSTOMER_CONFIRMED → Registers on blockchain → ONCHAIN_PENDING → ACTIVE
// - REJECTION of CUSTOMER_CONFIRMED → Stays off-chain → REJECTED (can resubmit)
// =============================================================================
/*
workflowInstancesRouter.post(
  '/:id/submit-to-chain',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    throw createError(
      'This endpoint is deprecated. Blockchain registration now happens when an approver approves the workflow.',
      410, // HTTP 410 Gone
      'ENDPOINT_DEPRECATED'
    );
  }
);
*/

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
 * 
 * CORRECTED BUSINESS LOGIC:
 * - APPROVAL of CUSTOMER_CONFIRMED workflow → triggers blockchain registration
 * - REJECTION of CUSTOMER_CONFIRMED workflow → stays off-chain, can be resubmitted
 * - Transitions on ACTIVE workflows → on-chain (already registered)
 * 
 * CUSTOMERS are blocked from this endpoint.
 * Includes visibility check - user must have access to view the workflow.
 */
workflowInstancesRouter.post(
  '/:id/transition',
  requireAuth,
  blockCustomerRole, // Customers cannot perform transitions
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

      // VISIBILITY CHECK: User must be able to view this workflow to transition it
      const canView = await canViewWorkflow(
        req.user!.userId,
        req.user!.roles,
        {
          id: instance.id,
          orgId: instance.orgId,
          creatorId: instance.creatorId,
          assignedCustomerId: instance.assignedCustomerId,
          assignedApproverId: instance.assignedApproverId,
        }
      );

      if (!canView) {
        throw createError(
          'Access denied. You do not have permission to transition this workflow.',
          403,
          'FORBIDDEN'
        );
      }

      if (instance.status === 'COMPLETED') {
        throw createError('Workflow already completed', 400, 'WORKFLOW_COMPLETED');
      }

      // Get template states to determine if this is approval/rejection
      const states = instance.template.states as Array<{ id: number; name: string; isTerminal: boolean }>;
      const targetState = states.find(s => s.id === toState);
      const isApproval = targetState?.name?.toLowerCase().includes('approv') || toState === 10;
      const isRejection = targetState?.name?.toLowerCase().includes('reject') || toState === 11;

      // =======================================================================
      // CASE 1: CUSTOMER_CONFIRMED workflow - Approval or Rejection
      // =======================================================================
      // This is a SPECIAL CASE - approval/rejection of customer-confirmed workflows
      // bypasses normal template transition rules. Approvers can approve/reject directly.
      if (instance.status === 'CUSTOMER_CONFIRMED') {
        // Only approvers can approve/reject CUSTOMER_CONFIRMED workflows
        const isApprover = req.user!.roles.some((r: string) => 
          ['APPROVER', 'SENIOR_APPROVER', 'MANAGER', 'ADMIN'].includes(r)
        );
        
        if (!isApprover) {
          throw createError(
            'Only approvers can approve or reject workflows pending review.',
            403,
            'NOT_APPROVER'
          );
        }

        if (isRejection) {
          // =================================================================
          // REJECTION: Stay off-chain, allow resubmission
          // =================================================================
          const transition = await prisma.workflowTransition.create({
            data: {
              instanceId: id,
              fromState: instance.currentState,
              toState,
              action: 'REJECT',
              actorId: req.user!.userId,
              comment,
              status: 'CONFIRMED', // Off-chain, immediately confirmed
            },
          });

          // Update status to REJECTED and currentState to rejected state
          await prisma.workflowInstance.update({
            where: { id },
            data: {
              currentState: toState, // Update to rejected state
              status: 'REJECTED',
            },
          });

          await prisma.auditLog.create({
            data: {
              userId: req.user!.userId,
              action: 'WORKFLOW_REJECTED',
              resource: 'workflow_instance',
              resourceId: id,
              details: {
                fromState: instance.currentState,
                toState,
                reason: comment,
                note: 'Workflow rejected off-chain. Can be resubmitted.',
              },
            },
          });

          logger.info({
            instanceId: id,
            approverId: req.user!.userId,
            reason: comment,
          }, 'Workflow REJECTED (off-chain)');

          res.json({
            success: true,
            data: {
              instanceId: id,
              transitionId: transition.id,
              status: 'REJECTED',
              message: 'Workflow rejected. Requester and customer can make changes and resubmit.',
            },
          });
          return;
        }

        if (isApproval) {
          // =================================================================
          // APPROVAL: Register on blockchain - THIS IS THE ONLY PLACE
          // =================================================================
          
          // Check if server-side signing is available
          const { 
            isServerSigningAvailable,
            createWorkflowInstanceOnChain,
          } = await import('../lib/casper.js');

          if (!isServerSigningAvailable()) {
            throw createError(
              'Server-side signing not available. Contact administrator.',
              500,
              'SIGNING_UNAVAILABLE'
            );
          }

          // Build hashes for on-chain registration
          const templateHashString = instance.template.contractHash || sha256Hex(JSON.stringify(instance.template.states));
          const templateHashBytes = hexToBytes(templateHashString);
          const instanceData = instance.data as Record<string, unknown>;
          const dataHashBytes = sha256Bytes(JSON.stringify({
            instanceId: instance.id,
            templateId: instance.templateId,
            data: instanceData,
            approvedBy: req.user!.userId,
            approvedAt: new Date().toISOString(),
          }));

          // Submit create_workflow to blockchain
          const result = await createWorkflowInstanceOnChain(
            instance.id,
            templateHashBytes,
            dataHashBytes
          );

          if (!result.success || !result.deployHash) {
            throw createError(
              result.error || 'Failed to submit workflow to blockchain',
              500,
              'BLOCKCHAIN_SUBMIT_FAILED'
            );
          }

          // Create transition record
          const transition = await prisma.workflowTransition.create({
            data: {
              instanceId: id,
              fromState: instance.currentState,
              toState,
              action: 'APPROVE',
              actorId: req.user!.userId,
              comment,
              deployHash: result.deployHash,
              status: 'ONCHAIN_PENDING' as any,
            },
          });

          // Update instance status to ONCHAIN_PENDING (will become ACTIVE on confirmation)
          // Also update currentState to the approved state
          await prisma.workflowInstance.update({
            where: { id },
            data: {
              status: 'ONCHAIN_PENDING',
              currentState: toState, // Update to approved state
              deployHash: result.deployHash,
              submittedAt: new Date(),
            },
          });

          // Queue background job for confirmation polling
          // On confirmation, status will change to ACTIVE
          const { addInstanceRegistrationJob } = await import('../jobs/instance-registration.js');
          await addInstanceRegistrationJob(result.deployHash, instance.id, 1);

          await prisma.auditLog.create({
            data: {
              userId: req.user!.userId,
              action: 'WORKFLOW_APPROVED_ONCHAIN',
              resource: 'workflow_instance',
              resourceId: id,
              details: {
                fromState: instance.currentState,
                toState,
                deployHash: result.deployHash,
                note: 'Workflow approved and submitted to blockchain.',
              },
            },
          });

          logger.info({
            instanceId: id,
            approverId: req.user!.userId,
            deployHash: result.deployHash,
          }, 'Workflow APPROVED - submitted to blockchain');

          res.json({
            success: true,
            data: {
              instanceId: id,
              transitionId: transition.id,
              status: 'ONCHAIN_PENDING',
              deployHash: result.deployHash,
              explorerUrl: `https://testnet.cspr.live/deploy/${result.deployHash}`,
              message: 'Workflow approved and submitted to blockchain. Waiting for confirmation.',
            },
          });
          return;
        }

        // Non-approval/rejection transition on CUSTOMER_CONFIRMED - not allowed
        throw createError(
          'Workflow is pending approval. Only approve or reject actions are allowed.',
          400,
          'PENDING_APPROVAL'
        );
      }

      // =======================================================================
      // CASE 2: DRAFT or PENDING_CUSTOMER_CONFIRMATION - Not ready for transitions
      // =======================================================================
      if (['DRAFT', 'PENDING_CUSTOMER_CONFIRMATION'].includes(instance.status)) {
        throw createError(
          'Workflow is not ready for approval. Customer must confirm first.',
          400,
          'NOT_READY_FOR_APPROVAL'
        );
      }

      // =======================================================================
      // CASE 3: REJECTED - Must use resubmit endpoint
      // =======================================================================
      if (instance.status === 'REJECTED') {
        throw createError(
          'This workflow was rejected. Use the resubmit endpoint to resubmit it.',
          409,
          'USE_RESUBMIT_ENDPOINT'
        );
      }

      // =======================================================================
      // CASE 4: ONCHAIN_PENDING - Waiting for blockchain confirmation
      // =======================================================================
      if (instance.status === 'ONCHAIN_PENDING') {
        throw createError(
          'Workflow is being registered on blockchain. Please wait for confirmation.',
          409,
          'PENDING_BLOCKCHAIN_CONFIRMATION'
        );
      }

      // =======================================================================
      // CASE 5: ACTIVE workflow - Already on-chain, normal transitions
      // =======================================================================
      if (instance.status === 'ACTIVE' || instance.status === 'PENDING') {
        // Check permission for this transition using template rules
        const canPerform = await canTransition(
          req.user!.userId,
          instance.templateId,
          instance.currentState,
          toState
        );

        if (!canPerform) {
          throw createError('You do not have permission for this transition', 403, 'FORBIDDEN');
        }

        // Verify instance has an on-chain workflow ID
        const instanceWorkflowId = instance.workflowId;
        
        if (!instanceWorkflowId) {
          throw createError(
            'Workflow instance is not registered on-chain. This may be a legacy instance.',
            409,
            'INSTANCE_NOT_REGISTERED'
          );
        }

        // Check for existing pending transitions
        const pendingTransition = await prisma.workflowTransition.findFirst({
          where: {
            instanceId: id,
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

        // Check for legacy template
        if (instance.template.status === 'PUBLISHED' && !instance.template.onChainWorkflowId) {
          throw createError(
            'This workflow uses a legacy template not registered on blockchain.',
            409,
            'LEGACY_TEMPLATE'
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

        // Build server-side transition deploy
        const roleMask = await getUserRoleMask(req.user!.userId);
        const commentHash = comment ? sha256Bytes(comment) : new Uint8Array(32);

        const deploy = buildTransitionStateDeployServerSide(
          instanceWorkflowId.toString(),
          toState,
          roleMask,
          commentHash
        );

        if (!deploy) {
          throw createError('Failed to build transition deploy', 500, 'DEPLOY_BUILD_FAILED');
        }

        // Sign and submit deploy
        const deployHash = await signAndSubmitDeployServerSide(deploy);

        if (!deployHash) {
          throw createError('Failed to submit deploy to Casper network', 500, 'DEPLOY_SUBMIT_FAILED');
        }

        logger.info({ 
          instanceId: id, 
          deployHash, 
          fromState: instance.currentState, 
          toState,
        }, 'Transition deploy submitted to Casper network');

        // Create transition record
        const transition = await prisma.workflowTransition.create({
          data: {
            instanceId: id,
            fromState: instance.currentState,
            toState,
            action: 'TRANSITION',
            actorId: req.user!.userId,
            comment,
            deployHash,
            status: 'ONCHAIN_PENDING' as any,
          },
        });

        // Queue background job for confirmation polling
        const { addDeployConfirmationJob } = await import('../jobs/deploy-confirmation.js');
        await addDeployConfirmationJob(deployHash, transition.id, id, toState, 0);

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
        return;
      }

      // Unknown status
      throw createError(`Unexpected workflow status: ${instance.status}`, 400, 'INVALID_STATUS');
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
 * Includes visibility check - user must have access to view the workflow.
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

      // VISIBILITY CHECK: User must be able to view this workflow
      const canView = await canViewWorkflow(
        req.user!.userId,
        req.user!.roles,
        {
          id: instance.id,
          orgId: instance.orgId,
          creatorId: instance.creatorId,
          assignedCustomerId: instance.assignedCustomerId,
          assignedApproverId: instance.assignedApproverId,
        }
      );

      if (!canView) {
        throw createError(
          'Access denied. You do not have permission to view this workflow.',
          403,
          'FORBIDDEN'
        );
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
// Rejection & Resubmission
// =============================================================================

/**
 * Update a rejected workflow's data for resubmission.
 * Only allowed when status is REJECTED.
 * Does NOT trigger blockchain - just updates off-chain data.
 */
workflowInstancesRouter.patch(
  '/:id/update-data',
  requireAuth,
  blockCustomerRole,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { title, description, data } = req.body;

      const instance = await prisma.workflowInstance.findUnique({
        where: { id },
      });

      if (!instance) {
        throw createError('Workflow instance not found', 404, 'NOT_FOUND');
      }

      // Only allow updates on REJECTED or DRAFT workflows
      if (!['REJECTED', 'DRAFT'].includes(instance.status)) {
        throw createError(
          `Cannot update workflow in ${instance.status} status. Only REJECTED or DRAFT workflows can be updated.`,
          409,
          'INVALID_STATUS_FOR_UPDATE'
        );
      }

      // Build update object (only update provided fields)
      const updateData: Record<string, unknown> = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (data !== undefined) updateData.data = JSON.parse(JSON.stringify(data));

      const updated = await prisma.workflowInstance.update({
        where: { id },
        data: updateData,
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'WORKFLOW_DATA_UPDATED',
          resource: 'workflow_instance',
          resourceId: id,
          details: {
            previousStatus: instance.status,
            updatedFields: Object.keys(updateData),
          },
        },
      });

      res.json({
        success: true,
        data: {
          instance: {
            ...updated,
            workflowId: updated.workflowId?.toString() || null,
          },
          message: 'Workflow data updated. You can now resubmit.',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Resubmit a rejected workflow.
 * Triggers a new on-chain transition back to initial/pending state.
 * Requires the workflow to be in REJECTED status.
 * Can be done by: creator, assigned customer, or admin.
 */
workflowInstancesRouter.post(
  '/:id/resubmit',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { comment } = req.body;

      const instance = await prisma.workflowInstance.findUnique({
        where: { id },
        include: { template: true },
      });

      if (!instance) {
        throw createError('Workflow instance not found', 404, 'NOT_FOUND');
      }

      // Permission check: Only creator, assigned customer, or admin can resubmit
      const isCreator = instance.creatorId === req.user!.userId;
      const isAssignedCustomer = instance.assignedCustomerId === req.user!.userId;
      const isAdmin = req.user!.roles.some((r: string) => ['ADMIN', 'MANAGER'].includes(r));
      
      if (!isCreator && !isAssignedCustomer && !isAdmin) {
        throw createError(
          'Access denied. Only the creator, assigned customer, or admin can resubmit this workflow.',
          403,
          'RESUBMIT_FORBIDDEN'
        );
      }

      // Only allow resubmission of REJECTED workflows
      if (instance.status !== 'REJECTED') {
        throw createError(
          `Cannot resubmit workflow in ${instance.status} status. Only REJECTED workflows can be resubmitted.`,
          409,
          'INVALID_STATUS_FOR_RESUBMIT'
        );
      }

      // Check if workflow is off-chain (rejected before blockchain registration)
      // Off-chain rejected workflows can simply be resubmitted to CUSTOMER_CONFIRMED
      if (!instance.workflowId) {
        // OFF-CHAIN RESUBMIT: Simply reset status to CUSTOMER_CONFIRMED
        // This puts the workflow back in the queue for approver review
        await prisma.workflowInstance.update({
          where: { id },
          data: {
            status: 'CUSTOMER_CONFIRMED',
            currentState: 1, // Pending Review
          },
        });

        // Create transition record
        const transition = await prisma.workflowTransition.create({
          data: {
            instanceId: id,
            fromState: instance.currentState,
            toState: 1, // Pending Review
            action: 'RESUBMIT',
            actorId: req.user!.userId,
            comment: comment || 'Workflow resubmitted after rejection',
            status: 'CONFIRMED', // Off-chain, immediately confirmed
          },
        });

        // Audit log
        await prisma.auditLog.create({
          data: {
            userId: req.user!.userId,
            action: 'WORKFLOW_RESUBMITTED',
            resource: 'workflow_instance',
            resourceId: id,
            details: {
              previousStatus: 'REJECTED',
              newStatus: 'CUSTOMER_CONFIRMED',
              offChain: true,
              note: 'Workflow resubmitted for approver review (off-chain)',
            },
          },
        });

        logger.info({
          instanceId: id,
          userId: req.user!.userId,
          fromState: instance.currentState,
          toState: 1,
        }, 'Workflow resubmitted (off-chain) for approver review');

        res.json({
          success: true,
          data: {
            instanceId: id,
            transitionId: transition.id,
            status: 'CUSTOMER_CONFIRMED',
            message: 'Workflow resubmitted for approver review.',
          },
        });
        return;
      }

      // Find the "Pending Review" state (state ID 1 in our default templates)
      const states = instance.template.states as Array<{ id: number; name: string; isInitial?: boolean }>;
      const pendingState = states.find(s => s.id === 1 || s.name === 'Pending Review');
      
      if (!pendingState) {
        throw createError(
          'Template does not have a resubmission target state.',
          400,
          'NO_RESUBMIT_STATE'
        );
      }

      const toState = pendingState.id;

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

      // Build and submit resubmission transition
      const roleMask = await getUserRoleMask(req.user!.userId);
      const commentHash = comment ? sha256Bytes(comment) : new Uint8Array(32);

      const deploy = buildTransitionStateDeployServerSide(
        instance.workflowId.toString(),
        toState,
        roleMask,
        commentHash
      );

      if (!deploy) {
        throw createError('Failed to build resubmission deploy', 500, 'DEPLOY_BUILD_FAILED');
      }

      const deployHash = await signAndSubmitDeployServerSide(deploy);

      if (!deployHash) {
        throw createError('Failed to submit resubmission deploy', 500, 'DEPLOY_SUBMIT_FAILED');
      }

      logger.info({ 
        instanceId: id, 
        deployHash, 
        fromState: instance.currentState, 
        toState,
        action: 'RESUBMIT'
      }, 'Resubmission deploy submitted to Casper network');

      // Create transition record
      const transition = await prisma.workflowTransition.create({
        data: {
          instanceId: id,
          fromState: instance.currentState,
          toState,
          action: 'RESUBMIT',
          actorId: req.user!.userId,
          comment: comment || 'Workflow resubmitted after rejection',
          deployHash,
          status: 'ONCHAIN_PENDING' as any,
        },
      });

      // Update instance status to PENDING (will be confirmed by background job)
      await prisma.workflowInstance.update({
        where: { id },
        data: {
          status: 'PENDING',
          submittedAt: new Date(),
        },
      });

      // Queue background job for confirmation
      const { addDeployConfirmationJob } = await import('../jobs/deploy-confirmation.js');
      await addDeployConfirmationJob(deployHash, transition.id, id, toState, 0);

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'WORKFLOW_RESUBMITTED',
          resource: 'workflow_instance',
          resourceId: id,
          details: {
            fromState: instance.currentState,
            toState,
            deployHash,
          },
          deployHash,
        },
      });

      res.json({
        success: true,
        data: {
          instanceId: id,
          transitionId: transition.id,
          deployHash,
          status: 'ONCHAIN_PENDING',
          explorerUrl: `https://testnet.cspr.live/deploy/${deployHash}`,
          message: 'Workflow resubmitted. Waiting for blockchain confirmation.',
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
 * Includes visibility check - user must have access to view the workflow.
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

      // VISIBILITY CHECK: User must be able to view this workflow
      const canView = await canViewWorkflow(
        req.user!.userId,
        req.user!.roles,
        {
          id: instance.id,
          orgId: instance.orgId,
          creatorId: instance.creatorId,
          assignedCustomerId: instance.assignedCustomerId,
          assignedApproverId: instance.assignedApproverId,
        }
      );

      if (!canView) {
        throw createError(
          'Access denied. You do not have permission to view this workflow.',
          403,
          'FORBIDDEN'
        );
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
 * Includes visibility check - user must have access to view the workflow.
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

      // VISIBILITY CHECK: User must be able to view this workflow to upload documents
      const canView = await canViewWorkflow(
        req.user!.userId,
        req.user!.roles,
        {
          id: instance.id,
          orgId: instance.orgId,
          creatorId: instance.creatorId,
          assignedCustomerId: instance.assignedCustomerId,
          assignedApproverId: instance.assignedApproverId,
        }
      );

      if (!canView) {
        throw createError(
          'Access denied. You do not have permission to view this workflow.',
          403,
          'FORBIDDEN'
        );
      }

      // DOCUMENT PERMISSION CHECK: Only customer, creator, manager, or admin can upload
      // Approvers have view-only access
      const canModify = canModifyDocuments(
        req.user!.userId,
        req.user!.roles,
        {
          creatorId: instance.creatorId,
          assignedCustomerId: instance.assignedCustomerId,
        }
      );

      if (!canModify) {
        throw createError(
          'Access denied. Only the assigned customer, requester, or admin can upload documents.',
          403,
          'DOCUMENT_UPLOAD_FORBIDDEN'
        );
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
 * Includes visibility check - user must have access to view the workflow.
 */
workflowInstancesRouter.delete(
  '/:id/documents/:documentId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, documentId } = req.params;

      const instance = await prisma.workflowInstance.findFirst({
        where: { id },
      });

      if (!instance) {
        throw createError('Workflow instance not found', 404, 'NOT_FOUND');
      }

      // VISIBILITY CHECK: User must be able to view this workflow to delete documents
      const canView = await canViewWorkflow(
        req.user!.userId,
        req.user!.roles,
        {
          id: instance.id,
          orgId: instance.orgId,
          creatorId: instance.creatorId,
          assignedCustomerId: instance.assignedCustomerId,
          assignedApproverId: instance.assignedApproverId,
        }
      );

      if (!canView) {
        throw createError(
          'Access denied. You do not have permission to view this workflow.',
          403,
          'FORBIDDEN'
        );
      }

      // BLOCKCHAIN CHECK: Cannot delete documents after workflow is registered on-chain
      // Once on-chain, documents are immutable as part of the audit trail
      if (instance.workflowId) {
        throw createError(
          'Cannot delete documents after workflow is registered on blockchain. Documents are immutable for audit purposes.',
          403,
          'DOCUMENT_DELETE_IMMUTABLE'
        );
      }

      // DOCUMENT PERMISSION CHECK: Only customer, creator, manager, or admin can delete
      // Approvers have view-only access
      const canModify = canModifyDocuments(
        req.user!.userId,
        req.user!.roles,
        {
          creatorId: instance.creatorId,
          assignedCustomerId: instance.assignedCustomerId,
        }
      );

      if (!canModify) {
        throw createError(
          'Access denied. Only the assigned customer, requester, or admin can delete documents.',
          403,
          'DOCUMENT_DELETE_FORBIDDEN'
        );
      }

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

// =============================================================================
// Enterprise Extensions - Assignment Management
// =============================================================================

/**
 * Assign a customer to a workflow instance.
 * Requires MANAGER or ADMIN role.
 * Customers can then view the workflow and upload documents.
 */
workflowInstancesRouter.post(
  '/:id/assign-customer',
  requireAuth,
  requireManagerOrAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { customerId } = req.body;

      if (!customerId) {
        throw createError('customerId is required', 400, 'VALIDATION_ERROR');
      }

      const instance = await prisma.workflowInstance.findUnique({
        where: { id },
      });

      if (!instance) {
        throw createError('Workflow instance not found', 404, 'NOT_FOUND');
      }

      // Verify customer exists and has CUSTOMER role
      const customer = await prisma.user.findUnique({
        where: { id: customerId },
        include: { roles: { include: { role: true } } },
      });

      if (!customer) {
        throw createError('Customer user not found', 404, 'CUSTOMER_NOT_FOUND');
      }

      const isCustomer = customer.roles.some(r => r.role.name === 'CUSTOMER');
      if (!isCustomer) {
        throw createError('User does not have CUSTOMER role', 400, 'NOT_A_CUSTOMER');
      }

      // Update instance with customer assignment
      const updated = await prisma.workflowInstance.update({
        where: { id },
        data: { assignedCustomerId: customerId },
        include: {
          assignedCustomer: {
            select: { id: true, displayName: true, email: true },
          },
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'CUSTOMER_ASSIGNED',
          resource: 'workflow_instance',
          resourceId: id,
          details: {
            customerId,
            customerEmail: customer.email,
          },
        },
      });

      res.json({
        success: true,
        data: {
          instanceId: id,
          assignedCustomer: updated.assignedCustomer,
          message: 'Customer assigned successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Assign an approver to a workflow instance.
 * Requires MANAGER or ADMIN role.
 * Assigns a specific approver instead of using role-based matching.
 */
workflowInstancesRouter.post(
  '/:id/assign-approver',
  requireAuth,
  requireManagerOrAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { approverId } = req.body;

      if (!approverId) {
        throw createError('approverId is required', 400, 'VALIDATION_ERROR');
      }

      const instance = await prisma.workflowInstance.findUnique({
        where: { id },
      });

      if (!instance) {
        throw createError('Workflow instance not found', 404, 'NOT_FOUND');
      }

      // Verify approver exists and has APPROVER or SENIOR_APPROVER role
      const approver = await prisma.user.findUnique({
        where: { id: approverId },
        include: { roles: { include: { role: true } } },
      });

      if (!approver) {
        throw createError('Approver user not found', 404, 'APPROVER_NOT_FOUND');
      }

      const isApprover = approver.roles.some(r => 
        ['APPROVER', 'SENIOR_APPROVER', 'ADMIN'].includes(r.role.name)
      );
      if (!isApprover) {
        throw createError('User does not have approver permissions', 400, 'NOT_AN_APPROVER');
      }

      // Update instance with approver assignment
      const updated = await prisma.workflowInstance.update({
        where: { id },
        data: { assignedApproverId: approverId },
        include: {
          assignedApprover: {
            select: { id: true, displayName: true, email: true },
          },
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'APPROVER_ASSIGNED',
          resource: 'workflow_instance',
          resourceId: id,
          details: {
            approverId,
            approverEmail: approver.email,
          },
        },
      });

      res.json({
        success: true,
        data: {
          instanceId: id,
          assignedApprover: updated.assignedApprover,
          message: 'Approver assigned successfully',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get workflows assigned to the current customer.
 * Returns only workflows where assignedCustomerId matches current user.
 */
workflowInstancesRouter.get(
  '/my-assigned',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = '1', limit = '20' } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);
      const skip = (pageNum - 1) * limitNum;

      const [instances, total] = await Promise.all([
        prisma.workflowInstance.findMany({
          where: { assignedCustomerId: req.user!.userId },
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            template: {
              select: { id: true, name: true, version: true },
            },
            creator: {
              select: { id: true, displayName: true },
            },
          },
        }),
        prisma.workflowInstance.count({
          where: { assignedCustomerId: req.user!.userId },
        }),
      ]);

      res.json({
        success: true,
        data: {
          instances: instances.map(i => ({
            ...i,
            workflowId: i.workflowId?.toString() || null,
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

// =============================================================================
// Manager/Admin Search Endpoints (NEW)
// =============================================================================

/**
 * Search workflows by user (MANAGER/ADMIN only).
 * Allows managers to view workflows by customer or requester.
 * 
 * Query parameters:
 * - customerId: Filter by assigned customer
 * - requesterId: Filter by workflow creator
 * - status: Filter by status
 * - page, limit: Pagination
 */
workflowInstancesRouter.get(
  '/search/by-user',
  requireAuth,
  requireManagerOrAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        customerId,
        requesterId,
        approverId,
        status,
        page = '1',
        limit = '20',
      } = req.query;

      // At least one user filter required
      if (!customerId && !requesterId && !approverId) {
        throw createError(
          'At least one of customerId, requesterId, or approverId is required',
          400,
          'VALIDATION_ERROR'
        );
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);
      const skip = (pageNum - 1) * limitNum;

      // Build query with user filters
      const where: Record<string, unknown> = {};
      if (customerId) where.assignedCustomerId = customerId;
      if (requesterId) where.creatorId = requesterId;
      if (approverId) where.assignedApproverId = approverId;
      if (status) where.status = status;

      // Scope to manager's organization
      const userOrgs = await prisma.organizationUser.findMany({
        where: { userId: req.user!.userId },
        select: { orgId: true },
      });
      if (userOrgs.length > 0) {
        where.orgId = { in: userOrgs.map(o => o.orgId) };
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
              select: { id: true, displayName: true, email: true },
            },
            assignedCustomer: {
              select: { id: true, displayName: true, email: true },
            },
            assignedApprover: {
              select: { id: true, displayName: true, email: true },
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
            workflowId: i.workflowId?.toString() || null,
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
 * Get workflows by specific user ID (MANAGER/ADMIN only).
 * Convenience endpoint to get all workflows associated with a user
 * (as customer, creator, or approver).
 */
workflowInstancesRouter.get(
  '/by-user/:userId',
  requireAuth,
  requireManagerOrAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const {
        role: roleFilter, // 'customer', 'requester', 'approver', or 'all'
        status,
        page = '1',
        limit = '20',
      } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);
      const skip = (pageNum - 1) * limitNum;

      // Verify target user exists
      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, displayName: true, email: true },
      });

      if (!targetUser) {
        throw createError('User not found', 404, 'NOT_FOUND');
      }

      // Build OR conditions based on role filter
      const orConditions: Array<Record<string, unknown>> = [];
      const filterRole = (roleFilter as string)?.toLowerCase() || 'all';

      if (filterRole === 'all' || filterRole === 'customer') {
        orConditions.push({ assignedCustomerId: userId });
      }
      if (filterRole === 'all' || filterRole === 'requester') {
        orConditions.push({ creatorId: userId });
      }
      if (filterRole === 'all' || filterRole === 'approver') {
        orConditions.push({ assignedApproverId: userId });
      }

      // Scope to manager's organization
      const userOrgs = await prisma.organizationUser.findMany({
        where: { userId: req.user!.userId },
        select: { orgId: true },
      });

      const where: Record<string, unknown> = {
        OR: orConditions,
      };
      if (userOrgs.length > 0) {
        where.orgId = { in: userOrgs.map(o => o.orgId) };
      }
      if (status) {
        where.status = status;
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
              select: { id: true, displayName: true, email: true },
            },
            assignedCustomer: {
              select: { id: true, displayName: true, email: true },
            },
            assignedApprover: {
              select: { id: true, displayName: true, email: true },
            },
          },
        }),
        prisma.workflowInstance.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          user: targetUser,
          instances: instances.map(i => ({
            ...i,
            workflowId: i.workflowId?.toString() || null,
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

// =============================================================================
// Customer Confirmation Flow
// =============================================================================

/**
 * Customer confirms their workflow assignment.
 * Only the assigned customer can confirm.
 * 
 * IMPORTANT: This is OFF-CHAIN only!
 * After confirmation, status changes to CUSTOMER_CONFIRMED.
 * The requester must then explicitly submit to blockchain via /submit-to-chain endpoint.
 */
workflowInstancesRouter.post(
  '/:id/customer/confirm',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const instance = await prisma.workflowInstance.findUnique({
        where: { id },
        include: {
          template: true,
        },
      });

      if (!instance) {
        throw createError('Workflow instance not found', 404, 'NOT_FOUND');
      }

      // Only assigned customer can confirm
      if (instance.assignedCustomerId !== req.user!.userId) {
        throw createError(
          'Access denied. Only the assigned customer can confirm this workflow.',
          403,
          'FORBIDDEN'
        );
      }

      // Must be in PENDING_CUSTOMER_CONFIRMATION status
      if (instance.status !== 'PENDING_CUSTOMER_CONFIRMATION') {
        throw createError(
          `Cannot confirm workflow in ${instance.status} status. Expected PENDING_CUSTOMER_CONFIRMATION.`,
          400,
          'INVALID_STATUS'
        );
      }

      // Update instance status to CUSTOMER_CONFIRMED (OFF-CHAIN only!)
      // NO blockchain interaction here - approver will approve/reject later
      // Also update currentState to 1 (Pending Review) to reflect the workflow is awaiting approval
      const updated = await prisma.workflowInstance.update({
        where: { id },
        data: { 
          status: 'CUSTOMER_CONFIRMED',
          currentState: 1, // Pending Review - awaiting approver decision
        },
      });

      // Create transition record for customer confirmation
      await prisma.workflowTransition.create({
        data: {
          instanceId: id,
          fromState: instance.currentState,
          toState: 1, // Pending Review
          action: 'CUSTOMER_CONFIRM',
          actorId: req.user!.userId,
          comment: 'Customer confirmed workflow details',
          status: 'CONFIRMED', // Off-chain, immediately confirmed
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'CUSTOMER_CONFIRMED',
          resource: 'workflow_instance',
          resourceId: id,
          details: {
            previousStatus: 'PENDING_CUSTOMER_CONFIRMATION',
            newStatus: 'CUSTOMER_CONFIRMED',
            templateId: instance.templateId,
            templateName: instance.template.name,
            note: 'Workflow confirmed by customer. Awaiting requester to submit to blockchain.',
          },
        },
      });

      logger.info({
        instanceId: id,
        customerId: req.user!.userId,
        templateId: instance.templateId,
      }, 'Customer confirmed workflow (off-chain). Awaiting requester to submit to blockchain.');

      res.json({
        success: true,
        data: {
          instanceId: id,
          status: updated.status,
          message: 'Customer confirmed workflow. Awaiting requester to submit to blockchain.',
          nextStep: 'Requester must click "Submit to Blockchain" to register this workflow on-chain.',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Customer rejects their workflow assignment.
 * Only the assigned customer can reject.
 * Changes status from PENDING_CUSTOMER_CONFIRMATION to REJECTED.
 * No blockchain interaction - this is an off-chain rejection.
 */
workflowInstancesRouter.post(
  '/:id/customer/reject',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const instance = await prisma.workflowInstance.findUnique({
        where: { id },
        include: {
          template: {
            select: { id: true, name: true },
          },
        },
      });

      if (!instance) {
        throw createError('Workflow instance not found', 404, 'NOT_FOUND');
      }

      // Only assigned customer can reject
      if (instance.assignedCustomerId !== req.user!.userId) {
        throw createError(
          'Access denied. Only the assigned customer can reject this workflow.',
          403,
          'FORBIDDEN'
        );
      }

      // Must be in PENDING_CUSTOMER_CONFIRMATION status
      if (instance.status !== 'PENDING_CUSTOMER_CONFIRMATION') {
        throw createError(
          `Cannot reject workflow in ${instance.status} status. Expected PENDING_CUSTOMER_CONFIRMATION.`,
          400,
          'INVALID_STATUS'
        );
      }

      // Update status to REJECTED
      const updated = await prisma.workflowInstance.update({
        where: { id },
        data: { status: 'REJECTED' },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: 'CUSTOMER_REJECTED',
          resource: 'workflow_instance',
          resourceId: id,
          details: {
            previousStatus: 'PENDING_CUSTOMER_CONFIRMATION',
            newStatus: 'REJECTED',
            templateId: instance.templateId,
            templateName: instance.template.name,
            reason: reason || 'No reason provided',
          },
        },
      });

      logger.info({
        instanceId: id,
        customerId: req.user!.userId,
        templateId: instance.templateId,
        reason,
      }, 'Customer rejected workflow');

      res.json({
        success: true,
        data: {
          instanceId: id,
          status: updated.status,
          message: 'Workflow rejected by customer.',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);