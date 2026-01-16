// =============================================================================
// Compliance Proof Service
// =============================================================================
// Generates and registers verifiable compliance proofs on the Casper blockchain.
// Proofs cryptographically link workflow approvals to document hashes.
// =============================================================================

import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import {
  buildRegisterComplianceProofDeploy,
  signAndSubmitDeployServerSide,
  isServerSigningAvailable,
  getDeployerPublicKey,
} from '../lib/casper.js';
import { addComplianceProofConfirmationJob } from '../jobs/compliance-proof-confirmation.js';

// =============================================================================
// Types
// =============================================================================

export interface DocumentProof {
  documentId: string;
  documentType: string;
  hash: string;
}

export interface ComplianceProofData {
  workflowId: string;
  templateId: string;
  finalState: string;
  approvedBy: string;
  approvedAt: number;
  documents: DocumentProof[];
  contractHash: string;
  deployHash: string;
  blockHash: string | null;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Hash a buffer using SHA-256
 */
export function sha256Hash(data: Buffer | string): string {
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Hash compliance proof JSON to create the on-chain proof hash
 */
export function hashComplianceProof(proof: ComplianceProofData): string {
  // Deterministic JSON serialization (sorted keys)
  const jsonString = JSON.stringify(proof, Object.keys(proof).sort());
  return sha256Hash(jsonString);
}

// =============================================================================
// Main Service Functions
// =============================================================================

/**
 * Generate a compliance proof for an approved workflow.
 * This collects all document hashes and creates the proof structure.
 */
export async function generateComplianceProof(
  instanceId: string,
  approvalDeployHash: string,
  approvalBlockHash: string | null,
  approvedByAccountHash: string
): Promise<{ proofData: ComplianceProofData; proofHash: string }> {
  // Fetch the workflow instance with documents and template
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: {
      template: true,
      documents: true,
      assignedApprover: true,
    },
  });

  if (!instance) {
    throw new Error(`Workflow instance not found: ${instanceId}`);
  }

  if (!instance.workflowId) {
    throw new Error(`Workflow instance has no on-chain ID: ${instanceId}`);
  }

  // Build document proofs array
  const documents: DocumentProof[] = instance.documents.map(doc => ({
    documentId: doc.id,
    documentType: doc.mimeType,
    hash: doc.checksum, // Already SHA-256 hash stored during upload
  }));

  // Build the compliance proof data
  const proofData: ComplianceProofData = {
    workflowId: instance.workflowId.toString(),
    templateId: instance.templateId,
    finalState: 'APPROVED',
    approvedBy: approvedByAccountHash,
    approvedAt: Math.floor(Date.now() / 1000),
    documents,
    contractHash: config.workflowContractHash || '',
    deployHash: approvalDeployHash,
    blockHash: approvalBlockHash,
  };

  // Hash the entire proof
  const proofHash = hashComplianceProof(proofData);

  logger.info({
    instanceId,
    workflowId: instance.workflowId.toString(),
    documentCount: documents.length,
    proofHash,
  }, 'Generated compliance proof');

  return { proofData, proofHash };
}

/**
 * Create and store a compliance proof record in the database.
 * This is called after approval confirmation, before on-chain registration.
 */
export async function createComplianceProofRecord(
  instanceId: string,
  proofData: ComplianceProofData,
  proofHash: string,
  approvalDeployHash: string,
  approvalBlockHash: string | null
): Promise<string> {
  const proof = await prisma.complianceProof.create({
    data: {
      instanceId,
      workflowId: proofData.workflowId,
      templateId: proofData.templateId,
      finalState: proofData.finalState,
      approvedBy: proofData.approvedBy,
      approvedAt: new Date(proofData.approvedAt * 1000),
      documentHashes: proofData.documents as unknown as Prisma.InputJsonValue,
      contractHash: proofData.contractHash,
      approvalDeployHash,
      approvalBlockHash,
      proofHash,
      proofJson: proofData as unknown as Prisma.InputJsonValue,
      status: 'PENDING',
    },
  });

  logger.info({ proofId: proof.id, proofHash }, 'Created compliance proof record');

  return proof.id;
}

/**
 * Register the compliance proof on-chain.
 * This builds and submits a deploy to call register_compliance_proof.
 */
export async function registerComplianceProofOnChain(
  proofId: string,
  workflowId: string,
  proofHash: string
): Promise<string | null> {
  if (!isServerSigningAvailable()) {
    logger.error('Server signing not available for compliance proof registration');
    await prisma.complianceProof.update({
      where: { id: proofId },
      data: {
        status: 'FAILED',
        error: 'Server signing not available',
      },
    });
    return null;
  }

  const deployerPublicKey = getDeployerPublicKey();
  if (!deployerPublicKey) {
    logger.error('Deployer public key not available');
    return null;
  }

  try {
    // Build the deploy
    const deploy = buildRegisterComplianceProofDeploy(
      deployerPublicKey,
      workflowId,
      proofHash
    );

    if (!deploy) {
      throw new Error('Failed to build compliance proof deploy');
    }

    // Sign and submit
    const deployHash = await signAndSubmitDeployServerSide(deploy);

    if (!deployHash) {
      throw new Error('Failed to sign and submit deploy');
    }

    // Update proof record with deploy hash
    await prisma.complianceProof.update({
      where: { id: proofId },
      data: {
        proofDeployHash: deployHash,
        status: 'ONCHAIN_PENDING',
      },
    });

    // Queue confirmation monitoring
    await addComplianceProofConfirmationJob(deployHash, proofId);

    logger.info({ proofId, deployHash, workflowId }, 'Submitted compliance proof registration deploy');

    return deployHash;
  } catch (error) {
    logger.error({ error, proofId, workflowId }, 'Failed to register compliance proof on-chain');
    
    await prisma.complianceProof.update({
      where: { id: proofId },
      data: {
        status: 'FAILED',
        error: String(error),
      },
    });

    return null;
  }
}

/**
 * Full flow: Generate and register a compliance proof after workflow approval.
 * Called by the deploy confirmation job when an approval is confirmed.
 */
export async function processApprovedWorkflowComplianceProof(
  instanceId: string,
  approvalDeployHash: string,
  approvalBlockHash: string | null,
  approvedByAccountHash: string
): Promise<void> {
  try {
    // Check if proof already exists
    const existing = await prisma.complianceProof.findUnique({
      where: { instanceId },
    });

    if (existing) {
      logger.info({ instanceId, proofId: existing.id }, 'Compliance proof already exists');
      return;
    }

    // Generate the proof
    const { proofData, proofHash } = await generateComplianceProof(
      instanceId,
      approvalDeployHash,
      approvalBlockHash,
      approvedByAccountHash
    );

    // Store in database
    const proofId = await createComplianceProofRecord(
      instanceId,
      proofData,
      proofHash,
      approvalDeployHash,
      approvalBlockHash
    );

    // Register on-chain
    await registerComplianceProofOnChain(proofId, proofData.workflowId, proofHash);

  } catch (error) {
    logger.error({ error, instanceId }, 'Failed to process compliance proof for approved workflow');
  }
}

/**
 * Verify a compliance proof against on-chain data.
 * This can be called without a wallet connection.
 */
export async function verifyComplianceProof(
  proofJson: ComplianceProofData
): Promise<{
  valid: boolean;
  localHash: string;
  onChainHash: string | null;
  error?: string;
}> {
  try {
    // Calculate hash of provided proof
    const localHash = hashComplianceProof(proofJson);

    // TODO: Query on-chain proof hash using contract read
    // For now, we verify against database record
    const dbProof = await prisma.complianceProof.findFirst({
      where: { proofHash: localHash },
    });

    if (!dbProof) {
      return {
        valid: false,
        localHash,
        onChainHash: null,
        error: 'Proof not found in database',
      };
    }

    if (dbProof.status !== 'CONFIRMED') {
      return {
        valid: false,
        localHash,
        onChainHash: dbProof.proofHash,
        error: `Proof status is ${dbProof.status}, not CONFIRMED`,
      };
    }

    return {
      valid: true,
      localHash,
      onChainHash: dbProof.proofHash,
    };
  } catch (error) {
    return {
      valid: false,
      localHash: '',
      onChainHash: null,
      error: String(error),
    };
  }
}

/**
 * Verify document hashes against a compliance proof.
 */
export function verifyDocumentHashes(
  proofDocuments: DocumentProof[],
  uploadedDocuments: Array<{ id: string; content: Buffer }>
): Array<{ documentId: string; valid: boolean; expectedHash: string; actualHash: string }> {
  return uploadedDocuments.map(doc => {
    const proofDoc = proofDocuments.find(p => p.documentId === doc.id);
    const actualHash = sha256Hash(doc.content);
    
    return {
      documentId: doc.id,
      valid: proofDoc ? proofDoc.hash === actualHash : false,
      expectedHash: proofDoc?.hash || 'NOT_IN_PROOF',
      actualHash,
    };
  });
}
