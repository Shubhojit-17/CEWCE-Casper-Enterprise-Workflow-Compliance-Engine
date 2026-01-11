// =============================================================================
// Template Registration Confirmation Worker
// =============================================================================
// Monitors template registration deploys for confirmation via Casper RPC polling.
// Extracts the on-chain workflow_id and updates the template record.
// Supports both Casper 1.x and 2.x deploy confirmation formats.
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

const QUEUE_NAME = 'template-registration';

interface TemplateRegistrationJob {
  deployHash: string;
  templateId: string;
  attempt: number;
}

let registrationQueue: Queue<TemplateRegistrationJob> | null = null;
let registrationWorker: Worker<TemplateRegistrationJob> | null = null;

const MAX_ATTEMPTS = 60; // 60 attempts * 5 second delay = 5 minutes max wait
const RETRY_DELAY = 5000; // 5 seconds

/**
 * Initialize the template registration confirmation worker.
 */
export async function initializeTemplateRegistrationWorker(): Promise<void> {
  registrationQueue = new Queue<TemplateRegistrationJob>(QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 100,
    },
  });

  registrationWorker = new Worker<TemplateRegistrationJob>(
    QUEUE_NAME,
    async (job: Job<TemplateRegistrationJob>) => {
      const { deployHash, templateId, attempt } = job.data;

      logger.info({ deployHash, templateId, attempt }, 'Checking template registration confirmation');

      try {
        const deployInfo = await getDeployInfo(deployHash);
        
        // Use shared helper to parse confirmation - handles both Casper 1.x and 2.x
        const confirmation = parseDeployConfirmation(deployInfo);

        if (confirmation.status === 'PENDING') {
          // Deploy not yet executed - re-queue
          logger.debug({ deployHash, templateId, attempt }, 'Deploy pending, re-queuing');
          if (attempt < MAX_ATTEMPTS) {
            await addTemplateRegistrationJob(deployHash, templateId, attempt + 1);
          } else {
            logger.error({ deployHash, templateId }, 'Template registration confirmation timed out');
          }
          return;
        }

        if (confirmation.status === 'FAILURE') {
          // Deploy failed on-chain
          logger.error({ 
            deployHash, 
            templateId, 
            error: confirmation.error, 
            blockHash: confirmation.blockHash 
          }, 'Template registration FAILED on-chain');
          
          await prisma.workflowTemplate.update({
            where: { id: templateId },
            data: { status: 'DRAFT' }, // Revert to DRAFT on failure
          });
          return;
        }

        // Deploy succeeded - extract workflow_id
        logger.info({ 
          deployHash, 
          templateId, 
          blockHash: confirmation.blockHash,
          executionCost: confirmation.executionCost
        }, 'Template registration deploy CONFIRMED on-chain');

        // Try to extract workflow_id from effects first
        let workflowId = extractWorkflowIdFromEffects(confirmation.effects);

        // Fallback: query workflow_count only after confirmation
        if (!workflowId) {
          logger.debug({ deployHash, templateId }, 'Could not extract workflow_id from effects, querying workflow_count');
          try {
            workflowId = await queryWorkflowCount();
          } catch (queryError) {
            logger.error({ deployHash, templateId, error: queryError }, 
              'Failed to query workflow_count after confirmation');
          }
        }

        if (workflowId && workflowId !== '0') {
          // Update template with on-chain workflow ID
          await prisma.workflowTemplate.update({
            where: { id: templateId },
            data: { onChainWorkflowId: BigInt(workflowId) },
          });
          
          logger.info({ 
            deployHash, 
            templateId, 
            onChainWorkflowId: workflowId, 
            blockHash: confirmation.blockHash,
            explorerUrl: `https://testnet.cspr.live/deploy/${deployHash}`
          }, 'Template registration CONFIRMED with on-chain workflow ID');
        } else {
          logger.error({ deployHash, templateId }, 
            'Template registration confirmed but could not determine workflow ID');
        }
      } catch (error) {
        logger.error({ error, deployHash, templateId }, 'Error checking template registration confirmation');

        if (attempt < MAX_ATTEMPTS) {
          await addTemplateRegistrationJob(deployHash, templateId, attempt + 1);
        }
      }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  registrationWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'Template registration job completed');
  });

  registrationWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Template registration job failed');
  });
}

/**
 * Add a template registration confirmation monitoring job.
 */
export async function addTemplateRegistrationJob(
  deployHash: string,
  templateId: string,
  attempt: number = 1
): Promise<string | undefined> {
  if (!registrationQueue) {
    logger.warn('Template registration queue not initialized');
    return undefined;
  }

  const job = await registrationQueue.add(
    'confirm-registration',
    {
      deployHash,
      templateId,
      attempt,
    },
    {
      delay: RETRY_DELAY,
      jobId: `template-reg-${deployHash}-${attempt}`,
    }
  );

  logger.debug({ deployHash, templateId, attempt }, 'Template registration job added');
  return job.id;
}
