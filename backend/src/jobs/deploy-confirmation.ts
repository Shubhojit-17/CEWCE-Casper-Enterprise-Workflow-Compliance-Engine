// =============================================================================
// Deploy Confirmation Worker (RPC-Only Mode)
// =============================================================================
// Monitors submitted deploys for confirmation via Casper RPC polling.
// Uses get-deploy RPC call to check execution results until finality.
// No Sidecar dependency - operates in RPC-only mode for hackathon.
// =============================================================================

import { Queue, Worker, type Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { getDeployInfo } from '../lib/casper.js';

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

const MAX_ATTEMPTS = 60; // 60 attempts * 5 second delay = 5 minutes max wait
const RETRY_DELAY = 5000; // 5 seconds

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
        const info = deployInfo as {
          execution_results?: Array<{
            result: { Success?: unknown; Failure?: { error_message: string } };
          }>;
        };

        if (!info.execution_results || info.execution_results.length === 0) {
          // Not yet processed
          if (attempt < MAX_ATTEMPTS) {
            // Re-queue with incremented attempt
            await addDeployConfirmationJob(
              deployHash,
              transitionId,
              instanceId,
              toState,
              attempt + 1
            );
          } else {
            // Max attempts reached
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

        const result = info.execution_results[0].result;

        if (result.Failure) {
          // Deploy failed
          logger.error({ deployHash, error: result.Failure }, 'Deploy execution failed');
          await prisma.workflowTransition.update({
            where: { id: transitionId },
            data: {
              status: 'FAILED',
              error: result.Failure.error_message,
            },
          });
          return;
        }

        // Deploy succeeded
        logger.info({ deployHash, transitionId }, 'Deploy confirmed');

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

        // Update instance and transition
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
            data: { status: 'CONFIRMED' },
          }),
        ]);

        logger.info({ instanceId, toState, isTerminal }, 'Instance state updated');
      } catch (error) {
        logger.error({ error, deployHash }, 'Error checking deploy confirmation');

        if (attempt < MAX_ATTEMPTS) {
          await addDeployConfirmationJob(
            deployHash,
            transitionId,
            instanceId,
            toState,
            attempt + 1
          );
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
