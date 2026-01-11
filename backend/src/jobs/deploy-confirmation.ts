// =============================================================================
// Deploy Confirmation Worker (RPC-Only Mode)
// =============================================================================
// Monitors submitted deploys for confirmation via Casper RPC polling.
// Uses get-deploy RPC call to check execution results until finality.
// Supports both Casper 1.x and 2.x deploy confirmation formats.
// =============================================================================

import { Queue, Worker, type Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { getDeployInfo, parseDeployConfirmation } from '../lib/casper.js';

const QUEUE_NAME = 'deploy-confirmation';

interface DeployConfirmationJob {
  deployHash: string;
  transitionId: string;
  instanceId: string;
  toState: number;
  attempt: number;
}

let confirmQueue: Queue<DeployConfirmationJob> | null = null;
let confirmWorker: Worker<DeployConfirmationJob> | null = null;

const MAX_ATTEMPTS = 120; // 120 attempts * 5 second delay = 10 minutes max wait
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Handle a successful transition confirmation
 */
async function handleSuccessfulTransition(
  transitionId: string,
  instanceId: string,
  toState: number,
  deployHash: string,
  blockHash: string | null,
  executionCost: string | null
): Promise<void> {
  // Get instance to check if terminal state
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: { template: true },
  });

  if (!instance) {
    logger.error({ instanceId }, 'Instance not found for confirmed deploy');
    return;
  }

  const states = instance.template.states as Array<{
    id: number;
    isTerminal: boolean;
  }>;
  const isTerminal = states.find(s => s.id === toState)?.isTerminal || false;

  // Get the transition for audit log
  const transition = await prisma.workflowTransition.findUnique({
    where: { id: transitionId },
  });

  // Update instance and transition in a transaction
  await prisma.$transaction([
    prisma.workflowInstance.update({
      where: { id: instanceId },
      data: {
        currentState: toState,
        status: isTerminal ? 'COMPLETED' : 'PENDING',
      },
    }),
    prisma.workflowTransition.update({
      where: { id: transitionId },
      data: { 
        status: 'CONFIRMED_ONCHAIN',
        blockHash,
        executionCost: executionCost ? BigInt(executionCost) : null,
        confirmedAt: new Date(),
      },
    }),
    // Create audit log for successful on-chain confirmation
    prisma.auditLog.create({
      data: {
        userId: transition?.actorId || 'system',
        action: 'TRANSITION_CONFIRMED_ONCHAIN',
        resource: 'WorkflowTransition',
        resourceId: transitionId,
        details: {
          deployHash,
          blockHash,
          executionCost: executionCost?.toString(),
          fromState: transition?.fromState,
          toState,
          isTerminal,
          explorerUrl: `https://testnet.cspr.live/deploy/${deployHash}`,
        },
      },
    }),
  ]);

  logger.info({ 
    instanceId, 
    toState, 
    isTerminal, 
    blockHash,
    explorerUrl: `https://testnet.cspr.live/deploy/${deployHash}`
  }, 'Workflow instance state updated - ON-CHAIN CONFIRMED');
}

/**
 * Handle a failed transition
 */
async function handleFailedTransition(
  transitionId: string,
  deployHash: string,
  blockHash: string | null,
  executionCost: string | null,
  errorMessage: string
): Promise<void> {
  // Get the transition for audit log
  const transition = await prisma.workflowTransition.findUnique({
    where: { id: transitionId },
  });

  await prisma.workflowTransition.update({
    where: { id: transitionId },
    data: {
      status: 'FAILED_ONCHAIN',
      error: errorMessage,
      blockHash,
      executionCost: executionCost ? BigInt(executionCost) : null,
      confirmedAt: new Date(),
    },
  });

  if (transition) {
    await prisma.auditLog.create({
      data: {
        userId: transition.actorId,
        action: 'TRANSITION_FAILED_ONCHAIN',
        resource: 'WorkflowTransition',
        resourceId: transitionId,
        details: {
          deployHash,
          blockHash,
          error: errorMessage,
          executionCost: executionCost?.toString(),
          fromState: transition.fromState,
          toState: transition.toState,
        },
      },
    });
  }
}

/**
 * Initialize the deploy confirmation worker.
 */
export async function initializeDeployConfirmationWorker(): Promise<void> {
  confirmQueue = new Queue<DeployConfirmationJob>(QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 100,
    },
  });

  confirmWorker = new Worker<DeployConfirmationJob>(
    QUEUE_NAME,
    async (job: Job<DeployConfirmationJob>) => {
      const { deployHash, transitionId, instanceId, toState, attempt } = job.data;

      logger.info({ deployHash, transitionId, attempt }, 'Checking deploy confirmation');

      try {
        const deployInfo = await getDeployInfo(deployHash);
        
        // Use shared helper to parse confirmation - handles both Casper 1.x and 2.x
        const confirmation = parseDeployConfirmation(deployInfo);

        if (confirmation.status === 'PENDING') {
          // Deploy not yet executed - re-queue
          logger.debug({ deployHash, transitionId, attempt }, 'Deploy pending, re-queuing');
          if (attempt < MAX_ATTEMPTS) {
            await addDeployConfirmationJob(deployHash, transitionId, instanceId, toState, attempt + 1);
          } else {
            logger.error({ deployHash, transitionId }, 'Deploy confirmation timed out');
            await prisma.workflowTransition.update({
              where: { id: transitionId },
              data: {
                status: 'TIMEOUT',
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
            transitionId,
            error: confirmation.error, 
            blockHash: confirmation.blockHash 
          }, 'Deploy execution FAILED on-chain');
          
          await handleFailedTransition(
            transitionId,
            deployHash,
            confirmation.blockHash || null,
            confirmation.executionCost || null,
            confirmation.error || 'Unknown error'
          );
          return;
        }

        // Deploy succeeded on-chain
        logger.info({ 
          deployHash, 
          transitionId, 
          blockHash: confirmation.blockHash, 
          executionCost: confirmation.executionCost 
        }, 'Deploy CONFIRMED on-chain');
        
        await handleSuccessfulTransition(
          transitionId, 
          instanceId, 
          toState, 
          deployHash, 
          confirmation.blockHash || null, 
          confirmation.executionCost || null
        );
      } catch (error) {
        logger.error({ error, deployHash, transitionId }, 'Error checking deploy confirmation');

        if (attempt < MAX_ATTEMPTS) {
          await addDeployConfirmationJob(deployHash, transitionId, instanceId, toState, attempt + 1);
        }
      }
    },
    {
      connection: redis,
      concurrency: 10,
    }
  );

  confirmWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Deploy confirmation job completed');
  });

  confirmWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Deploy confirmation job failed');
  });

  logger.info('Deploy confirmation worker initialized');
}

/**
 * Add a deploy confirmation monitoring job.
 */
export async function addDeployConfirmationJob(
  deployHash: string,
  transitionId: string,
  instanceId: string,
  toState: number,
  attempt: number = 1
): Promise<string | undefined> {
  if (!confirmQueue) {
    logger.warn('Deploy confirmation queue not initialized');
    return undefined;
  }

  const job = await confirmQueue.add(
    'confirm',
    {
      deployHash,
      transitionId,
      instanceId,
      toState,
      attempt,
    },
    {
      delay: attempt === 1 ? RETRY_DELAY : RETRY_DELAY, // Always delay
      jobId: `confirm-${deployHash}-${attempt}`,
    }
  );

  logger.debug({ deployHash, attempt }, 'Deploy confirmation job added');
  return job.id;
}
