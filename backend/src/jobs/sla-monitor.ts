// =============================================================================
// SLA Monitor Job
// =============================================================================
// Monitors workflow SLA deadlines and triggers escalation.
// =============================================================================

import { Queue, Worker, type Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const QUEUE_NAME = 'sla-monitor';

interface SlaMonitorJob {
  instanceId: string;
  deadline: string;
}

let slaQueue: Queue<SlaMonitorJob> | null = null;
let slaWorker: Worker<SlaMonitorJob> | null = null;

/**
 * Initialize the SLA monitor queue and worker.
 */
export async function initializeSlaMonitorWorker(): Promise<void> {
  slaQueue = new Queue<SlaMonitorJob>(QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 100, // Keep last 100 failed jobs for debugging
    },
  });

  slaWorker = new Worker<SlaMonitorJob>(
    QUEUE_NAME,
    async (job: Job<SlaMonitorJob>) => {
      const { instanceId, deadline } = job.data;
      
      logger.info({ instanceId, deadline }, 'Processing SLA check');

      // Get instance
      const instance = await prisma.workflowInstance.findUnique({
        where: { id: instanceId },
        include: { template: true },
      });

      if (!instance) {
        logger.warn({ instanceId }, 'Instance not found for SLA check');
        return;
      }

      // Skip if already completed
      if (instance.status === 'COMPLETED') {
        logger.info({ instanceId }, 'Instance already completed, skipping SLA check');
        return;
      }

      const now = new Date();
      const deadlineDate = new Date(deadline);

      if (now > deadlineDate) {
        // SLA breached
        logger.warn({ instanceId, deadline }, 'SLA deadline breached');

        // Update instance status to ESCALATED
        await prisma.workflowInstance.update({
          where: { id: instanceId },
          data: {
            status: 'ESCALATED',
          },
        });

        // Create SLA breach record in transitions
        await prisma.workflowTransition.create({
          data: {
            instanceId,
            fromState: instance.currentState,
            toState: instance.currentState, // No state change
            action: 'SLA_BREACH',
            actorId: instance.creatorId, // System action attributed to creator
            comment: `SLA deadline breached. Deadline was ${deadline}`,
            status: 'CONFIRMED',
          },
        });

        // TODO: Implement escalation logic
        // - Auto-escalate to senior approver
        // - Send notification emails
        // - Update workflow state if configured
      }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  slaWorker.on('completed', (job) => {
    logger.debug({ jobId: job.id }, 'SLA check job completed');
  });

  slaWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'SLA check job failed');
  });
}

/**
 * Add an SLA monitoring job for a workflow instance.
 */
export async function addSlaMonitorJob(
  instanceId: string,
  deadline: Date
): Promise<string | undefined> {
  if (!slaQueue) {
    logger.warn('SLA queue not initialized');
    return undefined;
  }

  // Calculate delay until deadline
  const delay = deadline.getTime() - Date.now();

  if (delay <= 0) {
    // Deadline already passed, process immediately
    const job = await slaQueue.add('sla-check', {
      instanceId,
      deadline: deadline.toISOString(),
    });
    return job.id;
  }

  // Schedule job for when deadline expires
  const job = await slaQueue.add(
    'sla-check',
    {
      instanceId,
      deadline: deadline.toISOString(),
    },
    {
      delay,
      jobId: `sla-${instanceId}`, // Unique job ID per instance
    }
  );

  logger.info({ instanceId, deadline, delay }, 'SLA monitor job scheduled');
  return job.id;
}

/**
 * Cancel SLA monitoring for a completed workflow.
 */
export async function cancelSlaMonitorJob(instanceId: string): Promise<void> {
  if (!slaQueue) return;

  const job = await slaQueue.getJob(`sla-${instanceId}`);
  if (job) {
    await job.remove();
    logger.info({ instanceId }, 'SLA monitor job cancelled');
  }
}
