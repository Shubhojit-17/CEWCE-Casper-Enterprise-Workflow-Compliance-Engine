// =============================================================================
// Audit Log Routes
// =============================================================================
// Query audit trails for compliance and reporting.
// =============================================================================

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { queryWorkflowHistory } from '../lib/casper.js';
import { createError } from '../middleware/error-handler.js';

export const auditRouter = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const querySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  actorId: z.string().uuid().optional(),
  instanceId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  actionType: z.enum(['CREATE', 'APPROVE', 'REJECT', 'ESCALATE', 'CANCEL']).optional(),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * Query audit log entries.
 * Requires AUDITOR or ADMIN role.
 */
auditRouter.get(
  '/',
  requireAuth,
  requireRole('AUDITOR', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = '1', limit = '50', ...filters } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);
      const skip = (pageNum - 1) * limitNum;

      const query = querySchema.parse(filters);

      const where: Record<string, unknown> = {};

      if (query.startDate) {
        where.createdAt = { ...where.createdAt as object, gte: new Date(query.startDate) };
      }
      if (query.endDate) {
        where.createdAt = { ...where.createdAt as object, lte: new Date(query.endDate) };
      }
      if (query.actorId) {
        where.actorId = query.actorId;
      }
      if (query.instanceId) {
        where.instanceId = query.instanceId;
      }

      const [transitions, total] = await Promise.all([
        prisma.workflowTransition.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            actor: {
              select: { id: true, publicKey: true, displayName: true },
            },
            instance: {
              select: {
                id: true,
                title: true,
                template: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        }),
        prisma.workflowTransition.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          entries: transitions.map(t => ({
            id: t.id,
            instanceId: t.instanceId,
            instanceTitle: t.instance.title,
            templateId: t.instance.template.id,
            templateName: t.instance.template.name,
            fromState: t.fromState,
            toState: t.toState,
            actor: t.actor,
            comment: t.comment,
            deployHash: t.deployHash,
            status: t.status,
            createdAt: t.createdAt,
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
 * Get audit trail for a specific workflow instance.
 */
auditRouter.get(
  '/instance/:id',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
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

      // Get state names from template
      const states = instance.template.states as Array<{ id: number; name: string }>;
      const getStateName = (stateId: number | null) => 
        stateId === null ? 'Initial' : states.find(s => s.id === stateId)?.name || `State ${stateId}`;

      const timeline = instance.transitions.map((t: typeof instance.transitions[0]) => ({
        id: t.id,
        fromState: t.fromState,
        fromStateName: getStateName(t.fromState),
        toState: t.toState,
        toStateName: getStateName(t.toState),
        actor: t.actor,
        comment: t.comment,
        deployHash: t.deployHash,
        status: t.status,
        timestamp: t.createdAt,
      }));

      res.json({
        success: true,
        data: {
          instance: {
            id: instance.id,
            title: instance.title,
            description: instance.description,
            templateId: instance.template.id,
            templateName: instance.template.name,
            currentState: instance.currentState,
            currentStateName: getStateName(instance.currentState),
            status: instance.status,
            creator: instance.creator,
            createdAt: instance.createdAt,
            updatedAt: instance.updatedAt,
          },
          timeline,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Verify on-chain audit data for a workflow.
 * Compares off-chain records with blockchain state.
 */
auditRouter.get(
  '/verify/:instanceId',
  requireAuth,
  requireRole('AUDITOR', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { instanceId } = req.params;

      const instance = await prisma.workflowInstance.findUnique({
        where: { id: instanceId },
        include: {
          transitions: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!instance) {
        throw createError('Workflow instance not found', 404, 'NOT_FOUND');
      }

      // If no blockchain workflow ID, cannot verify
      if (!instance.workflowId) {
        res.json({
          success: true,
          data: {
            verified: false,
            reason: 'No blockchain workflow ID. Instance may not have been recorded on-chain.',
            offChainTransitions: instance.transitions.length,
            onChainTransitions: 0,
          },
        });
        return;
      }

      // Query on-chain history
      let onChainHistory: unknown[];
      try {
        onChainHistory = await queryWorkflowHistory(instance.workflowId.toString()) as unknown[];
      } catch (error) {
        res.json({
          success: true,
          data: {
            verified: false,
            reason: 'Failed to query blockchain. Contract may not be deployed.',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        });
        return;
      }

      // Compare transition counts
      const offChainCount = instance.transitions.filter(t => t.status === 'CONFIRMED').length;
      const onChainCount = Array.isArray(onChainHistory) ? onChainHistory.length : 0;

      const verified = offChainCount === onChainCount;

      res.json({
        success: true,
        data: {
          verified,
          offChainTransitions: offChainCount,
          onChainTransitions: onChainCount,
          discrepancy: verified ? null : {
            message: `Off-chain records (${offChainCount}) do not match on-chain (${onChainCount})`,
            recommendation: 'Investigate unconfirmed transitions or sync with blockchain events',
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Export audit log as CSV.
 */
auditRouter.get(
  '/export',
  requireAuth,
  requireRole('AUDITOR', 'ADMIN'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, instanceId } = req.query;

      const where: Record<string, unknown> = {};

      if (startDate) {
        where.createdAt = { ...where.createdAt as object, gte: new Date(startDate as string) };
      }
      if (endDate) {
        where.createdAt = { ...where.createdAt as object, lte: new Date(endDate as string) };
      }
      if (instanceId) {
        where.instanceId = instanceId;
      }

      const transitions = await prisma.workflowTransition.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        include: {
          actor: {
            select: { publicKey: true, displayName: true },
          },
          instance: {
            select: {
              title: true,
              template: {
                select: { name: true },
              },
            },
          },
        },
      });

      // Generate CSV
      const headers = [
        'Timestamp',
        'Instance ID',
        'Instance Title',
        'Template',
        'From State',
        'To State',
        'Actor Public Key',
        'Actor Name',
        'Actor Role',
        'Deploy Hash',
        'Status',
        'Comment',
      ];

      const rows = transitions.map(t => [
        t.createdAt.toISOString(),
        t.instanceId,
        t.instance.title,
        t.instance.template.name,
        t.fromState?.toString() || 'Initial',
        t.toState.toString(),
        t.actor.publicKey || '',
        t.actor.displayName || '',
        '', // Actor role would need to be computed from user roles
        t.deployHash || '',
        t.status,
        t.comment?.replace(/"/g, '""') || '',
      ]);

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-export-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
);
