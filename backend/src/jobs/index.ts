// =============================================================================
// Background Job Queue Initialization
// =============================================================================
// Reference: https://docs.bullmq.io/
// =============================================================================

import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { initializeSlaMonitorWorker } from './sla-monitor.js';
import { initializeDeployConfirmationWorker, addDeployConfirmationJob } from './deploy-confirmation.js';
import { initializeTemplateRegistrationWorker, addTemplateRegistrationJob } from './template-registration.js';
import { initializeInstanceRegistrationWorker, addInstanceRegistrationJob } from './instance-registration.js';
import { initializeComplianceProofConfirmationWorker, addComplianceProofConfirmationJob } from './compliance-proof-confirmation.js';

/**
 * Retry pending template registrations on startup.
 * Finds templates with registrationDeployHash but no onChainWorkflowId
 * and re-queues them for confirmation.
 */
async function retryPendingTemplateRegistrations(): Promise<void> {
  try {
    const pendingTemplates = await prisma.workflowTemplate.findMany({
      where: {
        registrationDeployHash: { not: null },
        onChainWorkflowId: null,
        status: 'PUBLISHED', // Only retry published templates
      },
      select: {
        id: true,
        registrationDeployHash: true,
        name: true,
      },
    });

    if (pendingTemplates.length === 0) {
      logger.info('No pending template registrations to retry');
      return;
    }

    logger.info({ count: pendingTemplates.length }, 'Found pending template registrations, queuing for retry');

    for (const template of pendingTemplates) {
      if (template.registrationDeployHash) {
        await addTemplateRegistrationJob(template.registrationDeployHash, template.id, 1);
        logger.info({ 
          templateId: template.id, 
          templateName: template.name,
          deployHash: template.registrationDeployHash 
        }, 'Queued pending template registration for retry');
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to retry pending template registrations');
  }
}

/**
 * Retry pending workflow instance registrations on startup.
 * Finds instances with deployHash but no workflowId and status is PENDING
 * and re-queues them for confirmation.
 */
async function retryPendingInstanceRegistrations(): Promise<void> {
  try {
    const pendingInstances = await prisma.workflowInstance.findMany({
      where: {
        deployHash: { not: null },
        workflowId: null,
        status: 'PENDING',
      },
      select: {
        id: true,
        deployHash: true,
        title: true,
      },
    });

    if (pendingInstances.length === 0) {
      logger.info('No pending instance registrations to retry');
      return;
    }

    logger.info({ count: pendingInstances.length }, 'Found pending instance registrations, queuing for retry');

    for (const instance of pendingInstances) {
      if (instance.deployHash) {
        await addInstanceRegistrationJob(instance.deployHash, instance.id, 1);
        logger.info({ 
          instanceId: instance.id, 
          instanceTitle: instance.title,
          deployHash: instance.deployHash 
        }, 'Queued pending instance registration for retry');
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to retry pending instance registrations');
  }
}

/**
 * Retry pending transition confirmations on startup.
 * Finds transitions with deployHash but status is ONCHAIN_PENDING
 * and re-queues them for confirmation.
 */
async function retryPendingTransitions(): Promise<void> {
  try {
    const pendingTransitions = await prisma.workflowTransition.findMany({
      where: {
        deployHash: { not: null },
        status: 'ONCHAIN_PENDING',
      },
      select: {
        id: true,
        instanceId: true,
        toState: true,
        deployHash: true,
      },
    });

    if (pendingTransitions.length === 0) {
      logger.info('No pending transitions to retry');
      return;
    }

    logger.info({ count: pendingTransitions.length }, 'Found pending transitions, queuing for retry');

    for (const transition of pendingTransitions) {
      if (transition.deployHash) {
        await addDeployConfirmationJob(
          transition.deployHash,
          transition.id,
          transition.instanceId,
          transition.toState,
          1 // Start fresh with attempt 1
        );
        logger.info({ 
          transitionId: transition.id, 
          instanceId: transition.instanceId,
          deployHash: transition.deployHash 
        }, 'Queued pending transition for retry');
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to retry pending transitions');
  }
}

/**
 * Retry pending compliance proof confirmations on startup.
 * Finds proofs with proofDeployHash but status is ONCHAIN_PENDING
 * and re-queues them for confirmation.
 */
async function retryPendingComplianceProofs(): Promise<void> {
  try {
    const pendingProofs = await prisma.complianceProof.findMany({
      where: {
        proofDeployHash: { not: null },
        status: 'ONCHAIN_PENDING',
      },
      select: {
        id: true,
        proofDeployHash: true,
        instanceId: true,
      },
    });

    if (pendingProofs.length === 0) {
      logger.info('No pending compliance proofs to retry');
      return;
    }

    logger.info({ count: pendingProofs.length }, 'Found pending compliance proofs, queuing for retry');

    for (const proof of pendingProofs) {
      if (proof.proofDeployHash) {
        await addComplianceProofConfirmationJob(proof.proofDeployHash, proof.id, 1);
        logger.info({ 
          proofId: proof.id, 
          instanceId: proof.instanceId,
          deployHash: proof.proofDeployHash 
        }, 'Queued pending compliance proof for retry');
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to retry pending compliance proofs');
  }
}

/**
 * Initialize all background job workers.
 */
export async function initializeQueues(): Promise<void> {
  logger.info('Initializing background job queues...');

  try {
    await initializeSlaMonitorWorker();
    logger.info('SLA monitor worker initialized');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize SLA monitor worker');
  }

  try {
    await initializeDeployConfirmationWorker();
    logger.info('Deploy confirmation worker initialized');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize deploy confirmation worker');
  }

  try {
    await initializeTemplateRegistrationWorker();
    logger.info('Template registration worker initialized');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize template registration worker');
  }

  try {
    await initializeInstanceRegistrationWorker();
    logger.info('Instance registration worker initialized');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize instance registration worker');
  }

  try {
    await initializeComplianceProofConfirmationWorker();
    logger.info('Compliance proof confirmation worker initialized');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize compliance proof confirmation worker');
  }

  logger.info('Job queue initialization complete');

  // Retry any pending confirmations from previous runs
  logger.info('Checking for pending confirmations to retry...');
  await retryPendingTemplateRegistrations();
  await retryPendingInstanceRegistrations();
  await retryPendingTransitions();
  await retryPendingComplianceProofs();
  logger.info('Startup retry check complete');
}
