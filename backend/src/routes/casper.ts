// =============================================================================
// Casper Blockchain Routes
// =============================================================================
// Direct blockchain queries and transaction status.
// =============================================================================

import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createError } from '../middleware/error-handler.js';
import {
  getStateRootHash,
  getAccountInfo,
  getAccountBalance,
  getDeployInfo,
  queryWorkflowState,
  queryWorkflowCount,
} from '../lib/casper.js';
import { config } from '../lib/config.js';

export const casperRouter = Router();

// =============================================================================
// Routes
// =============================================================================

/**
 * Get Casper network status.
 */
casperRouter.get('/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stateRootHash = await getStateRootHash();

    res.json({
      success: true,
      data: {
        network: config.casperChainName,
        nodeUrl: config.casperNodeUrl,
        stateRootHash,
        contractConfigured: !!config.workflowContractHash && 
          config.workflowContractHash !== '<PROVIDED_AT_DEPLOYMENT>',
        contractHash: config.workflowContractHash || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get account information for a public key.
 */
casperRouter.get('/account/:publicKey', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { publicKey } = req.params;

    const [accountInfo, balance] = await Promise.all([
      getAccountInfo(publicKey).catch(() => null),
      getAccountBalance(publicKey).catch(() => '0'),
    ]);

    res.json({
      success: true,
      data: {
        publicKey,
        balance,
        accountInfo,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get deploy status by hash.
 */
casperRouter.get('/deploy/:deployHash', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deployHash } = req.params;

    const deployInfo = await getDeployInfo(deployHash);

    res.json({
      success: true,
      data: deployInfo,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw createError('Deploy not found', 404, 'DEPLOY_NOT_FOUND');
    }
    next(error);
  }
});

/**
 * Query workflow state from contract.
 */
casperRouter.get('/workflow/:workflowId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workflowId } = req.params;

    if (!config.workflowContractHash || config.workflowContractHash === '<PROVIDED_AT_DEPLOYMENT>') {
      throw createError('Contract not configured', 503, 'CONTRACT_NOT_CONFIGURED');
    }

    const state = await queryWorkflowState(workflowId);

    res.json({
      success: true,
      data: state,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get total workflow count from contract.
 */
casperRouter.get('/workflow-count', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    if (!config.workflowContractHash || config.workflowContractHash === '<PROVIDED_AT_DEPLOYMENT>') {
      throw createError('Contract not configured', 503, 'CONTRACT_NOT_CONFIGURED');
    }

    const count = await queryWorkflowCount();

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
});
