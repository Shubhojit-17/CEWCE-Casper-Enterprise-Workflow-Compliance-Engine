// =============================================================================
// Compliance Proof Confirmation Worker
// =============================================================================
// Monitors submitted compliance proof registration deploys for confirmation.
// =============================================================================

import { Queue, Worker, type Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { getDeployInfo, parseDeployConfirmation } from '../lib/casper.js';

const QUEUE_NAME = 'compliance-proof-confirmation';

interface ComplianceProofConfirmationJob {
  deployHash: string;
  proofId: string;
  attempt: number;
}

let confirmQueue: Queue<ComplianceProofConfirmationJob> | null = null;
let confirmWorker: Worker<ComplianceProofConfirmationJob> | null = null;

const MAX_ATTEMPTS = 120; // 120 attempts * 5 second delay = 10 minutes max wait
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Initialize the compliance proof confirmation worker.
 */
export async function initializeComplianceProofConfirmationWorker(): Promise<void> {
  confirmQueue = new Queue<ComplianceProofConfirmationJob>(QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 100,
    },
  });

  confirmWorker = new Worker<ComplianceProofConfirmationJob>(
    QUEUE_NAME,
    async (job: Job<ComplianceProofConfirmationJob>) => {
      const { deployHash, proofId, attempt } = job.data;

      logger.info({ deployHash, proofId, attempt }, 'Checking compliance proof confirmation');

      try {
        const deployInfo = await getDeployInfo(deployHash);
        
        // Use shared helper to parse confirmation - handles both Casper 1.x and 2.x
        const confirmation = parseDeployConfirmation(deployInfo);

        if (confirmation.status === 'PENDING') {
          // Deploy not yet executed - re-queue
          logger.debug({ deployHash, proofId, attempt }, 'Deploy pending, re-queuing');
          if (attempt < MAX_ATTEMPTS) {
            await addComplianceProofConfirmationJob(deployHash, proofId, attempt + 1);
          } else {
            logger.error({ deployHash, proofId }, 'Compliance proof confirmation timed out');
            await prisma.complianceProof.update({
              where: { id: proofId },
              data: {
                status: 'FAILED',
                error: 'Deploy confirmation timed out after maximum attempts',
              },
            });
          }
          return;
        }

        if (confirmation.status === 'FAILURE') {
          // Deploy failed on-chain
          logger.error({ 
            deployHash, 
            proofId,
            error: confirmation.error, 
            blockHash: confirmation.blockHash 
          }, 'Compliance proof deploy FAILED on-chain');
          
          await prisma.complianceProof.update({
            where: { id: proofId },
            data: {
              status: 'FAILED',
              proofBlockHash: confirmation.blockHash || null,
              error: confirmation.error || 'Unknown error',
            },
          });
          return;
        }

        // Deploy succeeded on-chain
        logger.info({ 
          deployHash, 
          proofId, 
          blockHash: confirmation.blockHash, 
        }, 'Compliance proof CONFIRMED on-chain');
        
        await prisma.complianceProof.update({
          where: { id: proofId },
          data: {
            status: 'CONFIRMED',
            proofBlockHash: confirmation.blockHash || null,
            confirmedAt: new Date(),
          },
        });

        // Create audit log
        const proof = await prisma.complianceProof.findUnique({
          where: { id: proofId },
        });

        if (proof) {
          await prisma.auditLog.create({
            data: {
              userId: 'system',
              action: 'COMPLIANCE_PROOF_CONFIRMED',
              resource: 'ComplianceProof',
              resourceId: proofId,
              details: {
                instanceId: proof.instanceId,
                workflowId: proof.workflowId,
                proofHash: proof.proofHash,
                deployHash,
                blockHash: confirmation.blockHash,
                explorerUrl: `https://testnet.cspr.live/deploy/${deployHash}`,
              },
            },
          });
        }

      } catch (error) {
        logger.error({ error, deployHash, proofId }, 'Error checking compliance proof confirmation');

        if (attempt < MAX_ATTEMPTS) {
          await addComplianceProofConfirmationJob(deployHash, proofId, attempt + 1);
        }
      }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  confirmWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Compliance proof confirmation job completed');
  });

  confirmWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Compliance proof confirmation job failed');
  });

  logger.info('Compliance proof confirmation worker initialized');
}

/**
 * Add a compliance proof confirmation monitoring job.
 */
export async function addComplianceProofConfirmationJob(
  deployHash: string,
  proofId: string,
  attempt: number = 1
): Promise<string | undefined> {
  if (!confirmQueue) {
    logger.warn('Compliance proof confirmation queue not initialized');
    return undefined;
  }

  const job = await confirmQueue.add(
    'confirm',
    {
      deployHash,
      proofId,
      attempt,
    },
    {
      delay: attempt === 1 ? RETRY_DELAY : RETRY_DELAY,
      jobId: `compliance-proof-confirm-${deployHash}-${attempt}`,
    }
  );

  logger.debug({ deployHash, proofId, attempt }, 'Compliance proof confirmation job added');
  return job.id;
}
