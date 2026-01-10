// =============================================================================
// Casper Client Types
// =============================================================================
// Shared types for Casper adapters
// =============================================================================

/**
 * Configuration for Casper adapters.
 */
export interface CasperAdapterConfig {
  rpcUrl: string;
  chainName: string;
  contractHash?: string;
  accessToken?: string;
  timeout?: number;
}

/**
 * Extended configuration for Sidecar adapter.
 */
export interface SidecarAdapterConfig extends CasperAdapterConfig {
  restUrl?: string;
  sseUrl?: string;
  adminUrl?: string;
}

/**
 * Block header structure (Casper 2.x format).
 */
export interface BlockHeader {
  height: number;
  era_id: number;
  state_root_hash: string;
  timestamp: string;
  protocol_version: string;
  parent_hash?: string;
  proposer?: string;
}

/**
 * Block structure.
 */
export interface Block {
  hash: string;
  header: BlockHeader;
}

/**
 * Deploy result structure.
 */
export interface DeployResult {
  deploy_hash: string;
  execution_results?: Array<{
    block_hash: string;
    result: {
      Success?: { effect: unknown; transfers: unknown[]; cost: string };
      Failure?: { error_message: string; cost: string };
    };
  }>;
}

/**
 * SSE Event structure from Sidecar.
 */
export interface SidecarSSEEvent {
  id: string;
  source: string;
  data: {
    BlockAdded?: { block_hash: string; block_header: BlockHeader };
    DeployProcessed?: { deploy_hash: string; execution_result: unknown };
    TransactionProcessed?: { transaction_hash: string; execution_result: unknown };
    Fault?: { era_id: number; public_key: string; timestamp: string };
    Step?: { era_id: number; execution_effect: unknown };
    Shutdown?: boolean;
  };
}

/**
 * Sidecar health check response.
 */
export interface SidecarHealth {
  connected: boolean;
  blockHeight: number | null;
  metrics: Record<string, unknown> | null;
}

/**
 * Common interface for Casper adapters.
 */
export interface ICasperAdapter {
  getLatestBlock(): Promise<unknown>;
  getBlock(identifier: string | number): Promise<unknown>;
  getStateRootHash(): Promise<string>;
  getAccountInfo(publicKeyHex: string): Promise<unknown>;
  getAccountBalance(publicKeyHex: string): Promise<string>;
  getDeployInfo(deployHash: string): Promise<unknown>;
  waitForDeploy(deployHash: string, timeoutMs?: number): Promise<unknown>;
  queryWorkflowState(workflowId: string): Promise<unknown>;
  queryWorkflowHistory(workflowId: string): Promise<unknown>;
  queryWorkflowCount(): Promise<string>;
}

/**
 * Workflow state from on-chain storage.
 */
export interface OnChainWorkflowState {
  workflow_id: string;
  template_hash: string;
  current_state: number;
  creator: string;
  created_at: string;
  data_hash: string;
}

/**
 * Workflow transition event.
 */
export interface WorkflowTransitionEvent {
  workflow_id: string;
  from_state: number;
  to_state: number;
  actor: string;
  actor_role: number;
  comment_hash: string;
  timestamp: string;
  block_hash: string;
  deploy_hash: string;
}
