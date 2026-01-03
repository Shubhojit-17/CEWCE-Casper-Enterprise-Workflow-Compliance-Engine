// =============================================================================
// Background Job Queue Initialization
// =============================================================================
// Reference: https://docs.bullmq.io/
// =============================================================================

import { logger } from '../lib/logger.js';
import { initializeSlaMonitorWorker } from './sla-monitor.js';
import { initializeDeployConfirmationWorker } from './deploy-confirmation.js';

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

  logger.info('Job queue initialization complete');
}
