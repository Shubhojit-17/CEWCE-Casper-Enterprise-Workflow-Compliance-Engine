// =============================================================================
// Compliance Proof Routes
// =============================================================================
// API endpoints for managing and verifying compliance proofs.
// =============================================================================

import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { createError } from '../middleware/error-handler.js';
import {
  hashComplianceProof,
  verifyDocumentHashes,
  type ComplianceProofData,
  type DocumentProof,
} from '../services/compliance-proof.js';

export const complianceProofRouter = Router();

// =============================================================================
// Validation Schemas
// =============================================================================

const verifyProofSchema = z.object({
  proof: z.object({
    workflowId: z.string(),
    templateId: z.string(),
    finalState: z.string(),
    approvedBy: z.string(),
    approvedAt: z.number(),
    documents: z.array(z.object({
      documentId: z.string(),
      documentType: z.string(),
      hash: z.string(),
    })),
    contractHash: z.string(),
    deployHash: z.string(),
    blockHash: z.string().nullable(),
  }),
});

// =============================================================================
// Routes
// =============================================================================

/**
 * Get compliance proof for a workflow instance.
 * Returns the full proof JSON if it exists and is confirmed.
 */
complianceProofRouter.get(
  '/instance/:instanceId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { instanceId } = req.params;

      const proof = await prisma.complianceProof.findUnique({
        where: { instanceId },
        include: {
          instance: {
            select: {
              id: true,
              title: true,
              status: true,
              workflowId: true,
              template: {
                select: { id: true, name: true },
              },
            },
          },
        },
      });

      if (!proof) {
        throw createError('Compliance proof not found', 404, 'NOT_FOUND');
      }

      res.json({
        success: true,
        data: {
          proof: {
            id: proof.id,
            instanceId: proof.instanceId,
            workflowId: proof.workflowId,
            templateId: proof.templateId,
            finalState: proof.finalState,
            approvedBy: proof.approvedBy,
            approvedAt: proof.approvedAt.toISOString(),
            documentHashes: proof.documentHashes,
            contractHash: proof.contractHash,
            approvalDeployHash: proof.approvalDeployHash,
            approvalBlockHash: proof.approvalBlockHash,
            proofHash: proof.proofHash,
            proofDeployHash: proof.proofDeployHash,
            proofBlockHash: proof.proofBlockHash,
            proofJson: proof.proofJson,
            status: proof.status,
            error: proof.error,
            createdAt: proof.createdAt.toISOString(),
            confirmedAt: proof.confirmedAt?.toISOString() || null,
            instance: proof.instance,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get compliance proof by proof hash.
 * Useful for verification without knowing the instance ID.
 */
complianceProofRouter.get(
  '/hash/:proofHash',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { proofHash } = req.params;

      const proof = await prisma.complianceProof.findFirst({
        where: { proofHash },
      });

      if (!proof) {
        throw createError('Compliance proof not found', 404, 'NOT_FOUND');
      }

      res.json({
        success: true,
        data: {
          proof: {
            id: proof.id,
            instanceId: proof.instanceId,
            workflowId: proof.workflowId,
            proofHash: proof.proofHash,
            status: proof.status,
            proofDeployHash: proof.proofDeployHash,
            proofBlockHash: proof.proofBlockHash,
            confirmedAt: proof.confirmedAt?.toISOString() || null,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Verify a compliance proof.
 * This endpoint is PUBLIC - no authentication required.
 * Anyone can verify a proof independently.
 */
complianceProofRouter.post(
  '/verify',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validation = verifyProofSchema.safeParse(req.body);
      
      if (!validation.success) {
        throw createError('Invalid proof format', 400, 'VALIDATION_ERROR');
      }

      const { proof } = validation.data;

      // Calculate hash of provided proof
      const computedHash = hashComplianceProof(proof as ComplianceProofData);

      // Look up in database
      const dbProof = await prisma.complianceProof.findFirst({
        where: { proofHash: computedHash },
      });

      if (!dbProof) {
        res.json({
          success: true,
          data: {
            verified: false,
            computedHash,
            onChainHash: null,
            status: null,
            error: 'Proof not found in system. The proof may have been tampered with or is not yet registered.',
          },
        });
        return;
      }

      // Check if confirmed on-chain
      const isVerified = dbProof.status === 'CONFIRMED';

      res.json({
        success: true,
        data: {
          verified: isVerified,
          computedHash,
          onChainHash: dbProof.proofHash,
          status: dbProof.status,
          proofDeployHash: dbProof.proofDeployHash,
          proofBlockHash: dbProof.proofBlockHash,
          confirmedAt: dbProof.confirmedAt?.toISOString() || null,
          explorerUrl: dbProof.proofDeployHash 
            ? `https://testnet.cspr.live/deploy/${dbProof.proofDeployHash}`
            : null,
          error: isVerified 
            ? null 
            : `Proof status is ${dbProof.status}, not CONFIRMED`,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Verify document hashes against a compliance proof.
 * Accepts base64-encoded document content and checks against proof.
 */
complianceProofRouter.post(
  '/verify-documents',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { proofHash, documents } = req.body as {
        proofHash: string;
        documents: Array<{ id: string; content: string }>;
      };

      if (!proofHash || !documents || !Array.isArray(documents)) {
        throw createError('proofHash and documents array required', 400, 'VALIDATION_ERROR');
      }

      // Get the proof
      const proof = await prisma.complianceProof.findFirst({
        where: { proofHash },
      });

      if (!proof) {
        throw createError('Compliance proof not found', 404, 'NOT_FOUND');
      }

      // Convert base64 content to buffers
      const documentsWithBuffers = documents.map(doc => ({
        id: doc.id,
        content: Buffer.from(doc.content, 'base64'),
      }));

      // Verify each document
      const proofDocuments = proof.documentHashes as unknown as DocumentProof[];
      const results = verifyDocumentHashes(proofDocuments, documentsWithBuffers);

      const allValid = results.every(r => r.valid);

      res.json({
        success: true,
        data: {
          allValid,
          proofStatus: proof.status,
          documentResults: results,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Export a compliance proof as downloadable JSON.
 */
complianceProofRouter.get(
  '/export/:instanceId',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { instanceId } = req.params;

      const proof = await prisma.complianceProof.findUnique({
        where: { instanceId },
      });

      if (!proof) {
        throw createError('Compliance proof not found', 404, 'NOT_FOUND');
      }

      if (proof.status !== 'CONFIRMED') {
        throw createError(
          'Cannot export unconfirmed proof',
          400,
          'PROOF_NOT_CONFIRMED'
        );
      }

      // Return the full proof JSON for download
      const exportData = {
        ...proof.proofJson as object,
        _metadata: {
          proofHash: proof.proofHash,
          proofDeployHash: proof.proofDeployHash,
          proofBlockHash: proof.proofBlockHash,
          confirmedAt: proof.confirmedAt?.toISOString(),
          explorerUrl: `https://testnet.cspr.live/deploy/${proof.proofDeployHash}`,
        },
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="compliance-proof-${instanceId}.json"`
      );

      res.json(exportData);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * List all compliance proofs (admin/auditor only).
 */
complianceProofRouter.get(
  '/',
  requireAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Only admins and auditors can list all proofs
      const hasAccess = req.user?.roles.some(r => 
        ['ADMIN', 'AUDITOR', 'MANAGER'].includes(r)
      );

      if (!hasAccess) {
        throw createError('Access denied', 403, 'FORBIDDEN');
      }

      const { page = '1', limit = '20', status } = req.query;
      const pageNum = parseInt(page as string, 10);
      const limitNum = Math.min(parseInt(limit as string, 10), 100);
      const skip = (pageNum - 1) * limitNum;

      const where: Record<string, unknown> = {};
      if (status) {
        where.status = status;
      }

      const [proofs, total] = await Promise.all([
        prisma.complianceProof.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            instance: {
              select: {
                id: true,
                title: true,
                template: { select: { name: true } },
              },
            },
          },
        }),
        prisma.complianceProof.count({ where }),
      ]);

      res.json({
        success: true,
        data: {
          proofs: proofs.map((p: typeof proofs[number]) => ({
            id: p.id,
            instanceId: p.instanceId,
            workflowId: p.workflowId,
            proofHash: p.proofHash,
            status: p.status,
            createdAt: p.createdAt.toISOString(),
            confirmedAt: p.confirmedAt?.toISOString() || null,
            instance: p.instance,
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
