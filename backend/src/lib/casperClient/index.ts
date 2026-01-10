// =============================================================================
// Casper Client Abstraction Layer
// =============================================================================
// Provides a unified interface for Casper blockchain operations with
// automatic failover between Sidecar and direct Node RPC.
//
// Architecture:
//   - Primary: Sidecar REST/RPC API (when enabled and available)
//   - Fallback: Direct Node RPC (always available)
//
// Reference: https://docs.casper.network/developers/dapps/sidecar/
// =============================================================================

import { SidecarAdapter } from './sidecarAdapter.js';
import { NodeAdapter } from './nodeAdapter.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

// Re-export types
export * from './types.js';

// =============================================================================
// Metrics for observability
// =============================================================================
export interface CasperClientMetrics {
  sidecarCalls: number;
  sidecarErrors: number;
  nodeCalls: number;
  nodeErrors: number;
  fallbackCount: number;
  lastFallbackReason: string | null;
  lastFallbackTime: Date | null;
}

const metrics: CasperClientMetrics = {
  sidecarCalls: 0,
  sidecarErrors: 0,
  nodeCalls: 0,
  nodeErrors: 0,
  fallbackCount: 0,
  lastFallbackReason: null,
  lastFallbackTime: null,
};

// =============================================================================
// Adapter instances
// =============================================================================
let sidecarAdapter: SidecarAdapter | null = null;
let nodeAdapter: NodeAdapter;

// Initialize adapters
function initializeAdapters(): void {
  // Node adapter is always available
  nodeAdapter = new NodeAdapter({
    rpcUrl: config.casperNodeUrl,
    accessToken: config.csprCloudAccessToken,
    chainName: config.casperChainName,
    contractHash: config.workflowContractHash,
  });

  // Sidecar adapter is optional
  if (config.casperSidecarUrl && config.casperUseSidecar) {
    sidecarAdapter = new SidecarAdapter({
      rpcUrl: config.casperSidecarUrl,
      restUrl: config.casperSidecarRestUrl,
      sseUrl: config.casperSidecarSseUrl,
      adminUrl: config.casperSidecarAdminUrl,
      chainName: config.casperChainName,
      contractHash: config.workflowContractHash,
      timeout: 2000, // 2s timeout for quick failover
    });
    logger.info({ sidecarUrl: config.casperSidecarUrl }, 'Sidecar adapter initialized');
  } else {
    logger.info('Running in RPC-only mode (Sidecar disabled)');
  }
}

// Initialize on module load
initializeAdapters();

// =============================================================================
// Unified Client Interface with Failover
// =============================================================================

/**
 * Execute a read operation with automatic failover.
 * Primary: Sidecar, Fallback: Node RPC
 */
async function executeWithFallback<T>(
  operation: string,
  sidecarFn: () => Promise<T>,
  nodeFn: () => Promise<T>
): Promise<T> {
  // If sidecar is not available, go directly to node
  if (!sidecarAdapter || !config.casperUseSidecar) {
    metrics.nodeCalls++;
    try {
      return await nodeFn();
    } catch (error) {
      metrics.nodeErrors++;
      throw error;
    }
  }

  // Try sidecar first
  try {
    metrics.sidecarCalls++;
    const result = await sidecarAdapter.executeWithTimeout(sidecarFn);
    return result;
  } catch (sidecarError) {
    metrics.sidecarErrors++;
    metrics.fallbackCount++;
    metrics.lastFallbackReason = (sidecarError as Error).message;
    metrics.lastFallbackTime = new Date();

    logger.warn(
      { operation, error: (sidecarError as Error).message },
      'Sidecar call failed, falling back to node RPC'
    );

    // Fallback to node
    try {
      metrics.nodeCalls++;
      return await nodeFn();
    } catch (nodeError) {
      metrics.nodeErrors++;
      throw nodeError;
    }
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get the latest block from the network.
 */
export async function getLatestBlock(): Promise<unknown> {
  return executeWithFallback(
    'getLatestBlock',
    () => sidecarAdapter!.getLatestBlock(),
    () => nodeAdapter.getLatestBlock()
  );
}

/**
 * Get a specific block by height or hash.
 */
export async function getBlock(identifier: string | number): Promise<unknown> {
  return executeWithFallback(
    'getBlock',
    () => sidecarAdapter!.getBlock(identifier),
    () => nodeAdapter.getBlock(identifier)
  );
}

/**
 * Get the current state root hash.
 */
export async function getStateRootHash(): Promise<string> {
  return executeWithFallback(
    'getStateRootHash',
    () => sidecarAdapter!.getStateRootHash(),
    () => nodeAdapter.getStateRootHash()
  );
}

/**
 * Get account information for a public key.
 */
export async function getAccountInfo(publicKeyHex: string): Promise<unknown> {
  return executeWithFallback(
    'getAccountInfo',
    () => sidecarAdapter!.getAccountInfo(publicKeyHex),
    () => nodeAdapter.getAccountInfo(publicKeyHex)
  );
}

/**
 * Get the account balance for a public key.
 */
export async function getAccountBalance(publicKeyHex: string): Promise<string> {
  return executeWithFallback(
    'getAccountBalance',
    () => sidecarAdapter!.getAccountBalance(publicKeyHex),
    () => nodeAdapter.getAccountBalance(publicKeyHex)
  );
}

/**
 * Get deploy information by hash.
 */
export async function getDeployInfo(deployHash: string): Promise<unknown> {
  return executeWithFallback(
    'getDeployInfo',
    () => sidecarAdapter!.getDeployInfo(deployHash),
    () => nodeAdapter.getDeployInfo(deployHash)
  );
}

/**
 * Wait for a deploy to be processed.
 */
export async function waitForDeploy(
  deployHash: string,
  timeoutMs: number = 120000
): Promise<unknown> {
  // For long-running operations, prefer the adapter that's available
  if (sidecarAdapter && config.casperUseSidecar) {
    try {
      return await sidecarAdapter.waitForDeploy(deployHash, timeoutMs);
    } catch (error) {
      logger.warn({ deployHash, error: (error as Error).message }, 'Sidecar waitForDeploy failed, using node');
    }
  }
  return nodeAdapter.waitForDeploy(deployHash, timeoutMs);
}

/**
 * Submit a signed deploy to the network.
 * Note: Deploy submission always uses Node RPC as it's write-critical.
 */
export async function submitDeploy(signedDeployJson: unknown): Promise<string> {
  // Writes are critical - use node RPC directly for reliability
  // Sidecar can forward but node is more reliable for puts
  metrics.nodeCalls++;
  try {
    return await nodeAdapter.submitDeploy(signedDeployJson);
  } catch (error) {
    metrics.nodeErrors++;
    throw error;
  }
}

/**
 * Query workflow state from the contract.
 */
export async function queryWorkflowState(workflowId: string): Promise<unknown> {
  return executeWithFallback(
    'queryWorkflowState',
    () => sidecarAdapter!.queryWorkflowState(workflowId),
    () => nodeAdapter.queryWorkflowState(workflowId)
  );
}

/**
 * Query workflow transition history from the contract.
 */
export async function queryWorkflowHistory(workflowId: string): Promise<unknown> {
  return executeWithFallback(
    'queryWorkflowHistory',
    () => sidecarAdapter!.queryWorkflowHistory(workflowId),
    () => nodeAdapter.queryWorkflowHistory(workflowId)
  );
}

/**
 * Query total workflow count from the contract.
 */
export async function queryWorkflowCount(): Promise<string> {
  return executeWithFallback(
    'queryWorkflowCount',
    () => sidecarAdapter!.queryWorkflowCount(),
    () => nodeAdapter.queryWorkflowCount()
  );
}

/**
 * Get network status (node connectivity, chain status).
 */
export async function getNetworkStatus(): Promise<{
  connected: boolean;
  usingSidecar: boolean;
  chainName: string;
  latestBlockHeight: number | null;
  nodeVersion: string | null;
}> {
  try {
    const block = await getLatestBlock() as { header?: { height?: number } };
    return {
      connected: true,
      usingSidecar: sidecarAdapter !== null && config.casperUseSidecar,
      chainName: config.casperChainName,
      latestBlockHeight: block?.header?.height ?? null,
      nodeVersion: null, // Can be queried separately
    };
  } catch {
    return {
      connected: false,
      usingSidecar: false,
      chainName: config.casperChainName,
      latestBlockHeight: null,
      nodeVersion: null,
    };
  }
}

/**
 * Get Sidecar health status (if available).
 */
export async function getSidecarHealth(): Promise<{
  available: boolean;
  connected: boolean;
  blockHeight: number | null;
  metrics: Record<string, unknown> | null;
}> {
  if (!sidecarAdapter) {
    return { available: false, connected: false, blockHeight: null, metrics: null };
  }

  try {
    const health = await sidecarAdapter.getHealth();
    return {
      available: true,
      connected: health.connected,
      blockHeight: health.blockHeight,
      metrics: health.metrics,
    };
  } catch {
    return { available: true, connected: false, blockHeight: null, metrics: null };
  }
}

/**
 * Get client metrics for monitoring.
 */
export function getMetrics(): CasperClientMetrics {
  return { ...metrics };
}

/**
 * Reset metrics (for testing).
 */
export function resetMetrics(): void {
  metrics.sidecarCalls = 0;
  metrics.sidecarErrors = 0;
  metrics.nodeCalls = 0;
  metrics.nodeErrors = 0;
  metrics.fallbackCount = 0;
  metrics.lastFallbackReason = null;
  metrics.lastFallbackTime = null;
}

/**
 * Check if Sidecar is enabled and available.
 */
export function isSidecarEnabled(): boolean {
  return sidecarAdapter !== null && config.casperUseSidecar;
}

/**
 * Get the node adapter for direct access (deploy building, etc.).
 */
export function getNodeAdapter(): NodeAdapter {
  return nodeAdapter;
}

/**
 * Get the sidecar adapter for direct access (SSE subscriptions, etc.).
 */
export function getSidecarAdapter(): SidecarAdapter | null {
  return sidecarAdapter;
}
// =============================================================================
// Convenience Object Export
// =============================================================================
// For easier import syntax: import { casperClient } from './casperClient'

export const casperClient = {
  getLatestBlock,
  getBlock,
  getDeploy: getDeployInfo,
  getDeployInfo,
  getStateRootHash,
  getAccountBalance,
  getAccountInfo,
  queryWorkflowState,
  queryWorkflowHistory,
  queryWorkflowCount,
  submitDeploy,
  sendDeploy: submitDeploy, // Alias
  putDeploy: submitDeploy, // Alias
  healthCheck: getSidecarHealth,
  getSidecarHealth,
  getNetworkStatus,
  getMetrics,
  resetMetrics,
  isSidecarEnabled,
  getNodeAdapter,
  getSidecarAdapter,
  waitForDeploy,
};