// =============================================================================
// Instance Registration Confirmation Worker
// =============================================================================
// Monitors workflow instance creation deploys for confirmation via Casper RPC polling.
// Extracts the on-chain workflow_id and updates the instance record.
// This is similar to template-registration.ts but for workflow instances.
// =============================================================================

import { Queue, Worker, type Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { 
  getDeployInfo, 
  parseDeployConfirmation, 
  extractWorkflowIdFromEffects,
  queryWorkflowCount 
} from '../lib/casper.js';

const QUEUE_NAME = 'instance-registration';

interface InstanceRegistrationJob {
  deployHash: string;
  instanceId: string;
  attempt: number;
}

let registrationQueue: Queue<InstanceRegistrationJob> | null = null;
let registrationWorker: Worker<InstanceRegistrationJob> | null = null;

const MAX_ATTEMPTS = 60; // 60 attempts * 5 second delay = 5 minutes max wait
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Initialize the instance registration confirmation worker.
 */
export async function initializeInstanceRegistrationWorker(): Promise<void> {
  registrationQueue = new Queue<InstanceRegistrationJob>(QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 100,
    },
  });

  registrationWorker = new Worker<InstanceRegistrationJob>(
    QUEUE_NAME,
    async (job: Job<InstanceRegistrationJob>) => {
      const { deployHash, instanceId, attempt } = job.data;

      logger.info({ deployHash, instanceId, attempt }, 'Checking instance registration confirmation');

      try {
        const deployInfo = await getDeployInfo(deployHash);
        
        // Use shared helper to parse confirmation - handles both Casper 1.x and 2.x
        const confirmation = parseDeployConfirmation(deployInfo);

        if (confirmation.status === 'PENDING') {
          // Deploy not yet executed - re-queue
          logger.debug({ deployHash, instanceId, attempt }, 'Instance deploy pending, re-queuing');
          if (attempt < MAX_ATTEMPTS) {
            await addInstanceRegistrationJob(deployHash, instanceId, attempt + 1);
          } else {
            logger.error({ deployHash, instanceId }, 'Instance registration confirmation timed out');
            // Update instance status to FAILED
            await prisma.workflowInstance.update({
              where: { id: instanceId },
              data: { status: 'DRAFT' }, // Revert to DRAFT on timeout
            });
          }
          return;
        }

        if (confirmation.status === 'FAILURE') {
          // Deploy failed on-chain
          logger.error({ 
            deployHash, 
            instanceId, 
            error: confirmation.error, 
            blockHash: confirmation.blockHash 
          }, 'Instance registration FAILED on-chain');
          
          await prisma.workflowInstance.update({
            where: { id: instanceId },
            data: { status: 'DRAFT' }, // Revert to DRAFT on failure
          });
          return;
        }

        // Deploy succeeded - extract workflow_id
        logger.info({ 
          deployHash, 
          instanceId, 
          blockHash: confirmation.blockHash,
          executionCost: confirmation.executionCost
        }, 'Instance registration deploy CONFIRMED on-chain');

        // Try to extract workflow_id from effects first
        let workflowId = extractWorkflowIdFromEffects(confirmation.effects);

        // Fallback: query workflow_count only after confirmation
        if (!workflowId) {
          logger.debug({ deployHash, instanceId }, 'Could not extract workflow_id from effects, querying workflow_count');
          try {
            workflowId = await queryWorkflowCount();
          } catch (queryError) {
            logger.error({ deployHash, instanceId, error: queryError }, 
              'Failed to query workflow_count after confirmation');
          }
        }

        if (workflowId && workflowId !== '0') {
          // Update instance with on-chain workflow ID and mark as PENDING (active)
          await prisma.workflowInstance.update({
            where: { id: instanceId },
            data: { 
              workflowId: BigInt(workflowId),
              status: 'PENDING', // Now active on-chain
              submittedAt: new Date(),
            },
          });
          
          logger.info({ 
            deployHash, 
            instanceId, 
            onChainWorkflowId: workflowId, 
            blockHash: confirmation.blockHash,
            explorerUrl: `https://testnet.cspr.live/deploy/${deployHash}`
          }, 'Instance registration CONFIRMED with on-chain workflow ID');

          // Update the initial transition record if it exists
          await prisma.workflowTransition.updateMany({
            where: { 
              instanceId, 
              action: 'CREATE',
              status: 'PENDING',
            },
            data: { 
              status: 'CONFIRMED_ONCHAIN',
              blockHash: confirmation.blockHash,
              confirmedAt: new Date(),
            },
          });
        } else {
          logger.error({ deployHash, instanceId }, 
            'Instance registration confirmed but could not determine workflow ID');
          // Still mark as pending since on-chain succeeded, we just couldn't get the ID
          await prisma.workflowInstance.update({
            where: { id: instanceId },
            data: { 
              status: 'PENDING',
              submittedAt: new Date(),
            },
          });
        }
      } catch (error) {
        logger.error({ error, deployHash, instanceId }, 'Error checking instance registration confirmation');

        if (attempt < MAX_ATTEMPTS) {
          await addInstanceRegistrationJob(deployHash, instanceId, attempt + 1);
        }
      }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  registrationWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Instance registration job completed');
  });

  registrationWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Instance registration job failed');
  });
}

/**
 * Add an instance registration confirmation monitoring job.
 */
export async function addInstanceRegistrationJob(
  deployHash: string,
  instanceId: string,
  attempt: number = 1
): Promise<string | undefined> {
  if (!registrationQueue) {
    logger.warn('Instance registration queue not initialized');
    return undefined;
  }

  const job = await registrationQueue.add(
    'confirm-instance-registration',
    {
      deployHash,
      instanceId,
      attempt,
    },
    {
      delay: RETRY_DELAY,
      jobId: `instance-reg-${deployHash}-${attempt}`,
    }
  );

  logger.debug({ deployHash, instanceId, attempt }, 'Instance registration job added');
  return job.id;
}
