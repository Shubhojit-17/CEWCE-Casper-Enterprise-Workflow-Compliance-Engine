// =============================================================================
// Node Adapter
// =============================================================================
// Adapter for direct Casper Node RPC API.
// This is the fallback adapter when Sidecar is unavailable.
// =============================================================================

import CasperSDK from 'casper-js-sdk';
const {
  CasperClient,
  CasperServiceByJsonRPC,
  CLPublicKey,
  DeployUtil,
  RuntimeArgs,
  CLValueBuilder,
  CLByteArray,
  Contracts,
} = CasperSDK;

import type { CasperAdapterConfig, ICasperAdapter } from './types.js';
import { logger } from '../logger.js';

// Type aliases for SDK types
type ContractType = InstanceType<typeof Contracts.Contract>;
type DeployType = ReturnType<typeof DeployUtil.makeDeploy>;

export class NodeAdapter implements ICasperAdapter {
  private rpcUrl: string;
  private accessToken?: string;
  private chainName: string;
  private contractHash?: string;
  private casperClient: InstanceType<typeof CasperClient>;
  private casperService: InstanceType<typeof CasperServiceByJsonRPC>;
  private contractClient: ContractType | null = null;

  constructor(config: CasperAdapterConfig) {
    this.rpcUrl = config.rpcUrl;
    this.accessToken = config.accessToken;
    this.chainName = config.chainName;
    this.contractHash = config.contractHash;

    // Initialize SDK clients
    this.casperClient = new CasperClient(this.rpcUrl);
    this.casperService = new CasperServiceByJsonRPC(this.rpcUrl);

    // Initialize contract client if hash provided
    if (this.contractHash && this.contractHash !== '<PROVIDED_AT_DEPLOYMENT>') {
      this.initializeContractClient(this.contractHash);
    }
  }

  /**
   * Initialize the contract client.
   */
  private initializeContractClient(contractHash: string): void {
    try {
      this.contractClient = new Contracts.Contract(this.casperClient);
      this.contractClient.setContractHash(contractHash);
      logger.info({ contractHash }, 'Contract client initialized (NodeAdapter)');
    } catch (error) {
      logger.error({ error, contractHash }, 'Failed to initialize contract client');
    }
  }

  /**
   * Make a raw JSON-RPC call with auth header support.
   */
  private async jsonRpcCall(method: string, params: unknown[] = []): Promise<unknown> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers['Authorization'] = this.accessToken;
    }

    const body = JSON.stringify({
      id: Date.now(),
      jsonrpc: '2.0',
      method,
      params,
    });

    logger.debug({ method, url: this.rpcUrl }, 'Node RPC call');

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, body: text }, 'Node RPC fetch failed');
      throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as { error?: { message?: string }; result?: unknown };
    if (result.error) {
      throw new Error(result.error.message || 'RPC Error');
    }
    return result.result;
  }

  // ==========================================================================
  // ICasperAdapter Implementation
  // ==========================================================================

  async getLatestBlock(): Promise<unknown> {
    const result = await this.jsonRpcCall('chain_get_block') as {
      block_with_signatures?: { block?: unknown };
      block?: unknown;
    };
    // Handle Casper 2.x format
    return result?.block_with_signatures?.block || result?.block;
  }

  async getBlock(identifier: string | number): Promise<unknown> {
    const params = typeof identifier === 'number'
      ? [{ Height: identifier }]
      : [{ Hash: identifier }];
    
    const result = await this.jsonRpcCall('chain_get_block', params) as {
      block_with_signatures?: { block?: unknown };
      block?: unknown;
    };
    return result?.block_with_signatures?.block || result?.block;
  }

  async getStateRootHash(): Promise<string> {
    const result = await this.jsonRpcCall('chain_get_block') as {
      block_with_signatures?: {
        block?: {
          Version2?: { header?: { state_root_hash: string } };
        };
      };
      block?: { header?: { state_root_hash: string } };
    };

    // Try Casper 2.x format first
    const stateRootHash = result?.block_with_signatures?.block?.Version2?.header?.state_root_hash
      || result?.block?.header?.state_root_hash;

    if (!stateRootHash) {
      throw new Error('Failed to get state root hash');
    }

    return stateRootHash;
  }

  async getAccountInfo(publicKeyHex: string): Promise<unknown> {
    const publicKey = CLPublicKey.fromHex(publicKeyHex);
    const stateRootHash = await this.getStateRootHash();
    const accountHash = publicKey.toAccountHashStr();

    return this.casperService.getBlockState(stateRootHash, accountHash, []);
  }

  async getAccountBalance(publicKeyHex: string): Promise<string> {
    const publicKey = CLPublicKey.fromHex(publicKeyHex);
    const balance = await this.casperClient.balanceOfByPublicKey(publicKey);
    return balance.toString();
  }

  async getDeployInfo(deployHash: string): Promise<unknown> {
    return this.casperService.getDeployInfo(deployHash);
  }

  async waitForDeploy(deployHash: string, timeoutMs: number = 120000): Promise<unknown> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const deployInfo = await this.getDeployInfo(deployHash) as {
          execution_results?: Array<{ result: unknown }>;
        };

        if (deployInfo.execution_results && deployInfo.execution_results.length > 0) {
          return deployInfo.execution_results[0].result;
        }
      } catch {
        // Deploy not yet processed, continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error(`Deploy ${deployHash} not processed within timeout`);
  }

  async queryWorkflowState(workflowId: string): Promise<unknown> {
    if (!this.contractHash) {
      throw new Error('Contract hash not configured');
    }

    // RPC failsafe: retry with exponential backoff
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const stateRootHash = await this.getStateRootHash();

        const result = await this.casperService.getDictionaryItemByName(
          stateRootHash,
          this.contractHash,
          'workflows',
          workflowId
        );
        return result;
      } catch (error) {
        lastError = error as Error;
        logger.warn({ workflowId, attempt, error: lastError.message }, 'Node RPC query failed, retrying...');

        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    logger.error({ workflowId, error: lastError?.message }, 'Failed to query workflow state after retries');
    return null;
  }

  async queryWorkflowHistory(workflowId: string): Promise<unknown> {
    if (!this.contractHash) {
      throw new Error('Contract hash not configured');
    }

    const stateRootHash = await this.getStateRootHash();

    try {
      const result = await this.casperService.getDictionaryItemByName(
        stateRootHash,
        this.contractHash,
        'transitions',
        workflowId
      );
      return result;
    } catch (error) {
      logger.warn({ workflowId, error }, 'Failed to query workflow history');
      return null;
    }
  }

  async queryWorkflowCount(): Promise<string> {
    if (!this.contractHash) {
      throw new Error('Contract hash not configured');
    }

    const stateRootHash = await this.getStateRootHash();

    const result = await this.casperService.getBlockState(
      stateRootHash,
      this.contractHash,
      ['workflow_count']
    );

    return result?.CLValue?.data?.toString() || '0';
  }

  // ==========================================================================
  // Node-specific methods (deploy building)
  // ==========================================================================

  /**
   * Submit a signed deploy to the network.
   */
  async submitDeploy(signedDeployJson: unknown): Promise<string> {
    const deploy = DeployUtil.deployFromJson(signedDeployJson as { deploy: unknown });

    if (!deploy.ok) {
      throw new Error('Invalid deploy JSON');
    }

    const deployHash = await this.casperClient.putDeploy(deploy.val);
    logger.info({ deployHash }, 'Deploy submitted to network');

    return deployHash;
  }

  /**
   * Build a deploy for creating a new workflow.
   */
  buildCreateWorkflowDeploy(
    senderPublicKeyHex: string,
    templateHash: Uint8Array,
    dataHash: Uint8Array,
    paymentAmount: string = '5000000000'
  ): DeployType | null {
    if (!this.contractClient) {
      logger.error('Contract client not initialized');
      return null;
    }

    const senderPublicKey = CLPublicKey.fromHex(senderPublicKeyHex);

    const args = RuntimeArgs.fromMap({
      template_hash: new CLByteArray(templateHash),
      data_hash: new CLByteArray(dataHash),
    });

    return this.contractClient.callEntrypoint(
      'create_workflow',
      args,
      senderPublicKey,
      this.chainName,
      paymentAmount
    );
  }

  /**
   * Build a deploy for transitioning workflow state.
   */
  buildTransitionStateDeploy(
    senderPublicKeyHex: string,
    workflowId: string,
    toState: number,
    actorRole: bigint,
    commentHash: Uint8Array,
    paymentAmount: string = '3000000000'
  ): DeployType | null {
    if (!this.contractClient) {
      logger.error('Contract client not initialized');
      return null;
    }

    const senderPublicKey = CLPublicKey.fromHex(senderPublicKeyHex);

    const args = RuntimeArgs.fromMap({
      workflow_id: CLValueBuilder.u256(workflowId),
      to_state: CLValueBuilder.u8(toState),
      actor_role: CLValueBuilder.u64(actorRole),
      comment_hash: new CLByteArray(commentHash),
    });

    return this.contractClient.callEntrypoint(
      'transition_state',
      args,
      senderPublicKey,
      this.chainName,
      paymentAmount
    );
  }

  /**
   * Get the underlying CasperClient for advanced operations.
   */
  getCasperClient(): InstanceType<typeof CasperClient> {
    return this.casperClient;
  }

  /**
   * Get the underlying CasperService for advanced operations.
   */
  getCasperService(): InstanceType<typeof CasperServiceByJsonRPC> {
    return this.casperService;
  }
}

// Re-export SDK types for use in other modules
export { CLPublicKey, DeployUtil, RuntimeArgs };
