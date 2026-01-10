// =============================================================================
// Sidecar Adapter
// =============================================================================
// Adapter for Casper Sidecar REST/RPC API.
// Reference: https://docs.casper.network/developers/dapps/sidecar/
// =============================================================================

import type { 
  SidecarAdapterConfig, 
  ICasperAdapter, 
  SidecarHealth,
  Block,
} from './types.js';
import { logger } from '../logger.js';

export class SidecarAdapter implements ICasperAdapter {
  private rpcUrl: string;
  private restUrl: string;
  private sseUrl: string;
  private adminUrl: string;
  // @ts-expect-error chainName preserved for potential future use
  private _chainName: string;
  private contractHash?: string;
  private timeout: number;

  constructor(config: SidecarAdapterConfig) {
    this.rpcUrl = config.rpcUrl;
    this.restUrl = config.restUrl || config.rpcUrl.replace('/rpc', '');
    this.sseUrl = config.sseUrl || '';
    this.adminUrl = config.adminUrl || '';
    this._chainName = config.chainName;
    this.contractHash = config.contractHash;
    this.timeout = config.timeout || 5000;
  }

  /**
   * Execute a function with timeout.
   */
  async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const result = await fn();
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Make a REST API call to the Sidecar.
   */
  private async restCall<T>(endpoint: string): Promise<T> {
    const url = `${this.restUrl}${endpoint}`;
    logger.debug({ url }, 'Sidecar REST call');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Sidecar REST error: ${response.status} ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Sidecar REST timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Make a JSON-RPC call to the Sidecar.
   */
  private async rpcCall<T>(method: string, params: unknown[] = []): Promise<T> {
    const url = this.rpcUrl;
    logger.debug({ url, method }, 'Sidecar RPC call');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Date.now(),
          jsonrpc: '2.0',
          method,
          params,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Sidecar RPC HTTP error: ${response.status}`);
      }

      const result = await response.json() as { result?: T; error?: { message: string } };
      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.result as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if ((error as Error).name === 'AbortError') {
        throw new Error(`Sidecar RPC timeout after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  // ==========================================================================
  // ICasperAdapter Implementation
  // ==========================================================================

  async getLatestBlock(): Promise<Block> {
    // Sidecar REST API: GET /block (latest block)
    return this.restCall<Block>('/block');
  }

  async getBlock(identifier: string | number): Promise<Block> {
    // Sidecar REST API: GET /block/:identifier
    return this.restCall<Block>(`/block/${identifier}`);
  }

  async getStateRootHash(): Promise<string> {
    const block = await this.getLatestBlock();
    return block.header.state_root_hash;
  }

  async getAccountInfo(publicKeyHex: string): Promise<unknown> {
    // Sidecar RPC: state_get_account_info
    return this.rpcCall('state_get_account_info', [{ PublicKey: publicKeyHex }]);
  }

  async getAccountBalance(publicKeyHex: string): Promise<string> {
    // Sidecar RPC: query_balance
    const result = await this.rpcCall<{ balance: string }>('query_balance', [
      { purse_identifier: { main_purse_under_public_key: publicKeyHex } }
    ]);
    return result.balance || '0';
  }

  async getDeployInfo(deployHash: string): Promise<unknown> {
    // Sidecar REST API: GET /deploy/:hash
    return this.restCall(`/deploy/${deployHash}`);
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

    const stateRootHash = await this.getStateRootHash();

    // Use state_get_dictionary_item RPC
    return this.rpcCall('state_get_dictionary_item', [
      {
        state_identifier: { StateRootHash: stateRootHash },
        dictionary_identifier: {
          ContractNamedKey: {
            key: this.contractHash,
            dictionary_name: 'workflows',
            dictionary_item_key: workflowId,
          },
        },
      },
    ]);
  }

  async queryWorkflowHistory(workflowId: string): Promise<unknown> {
    if (!this.contractHash) {
      throw new Error('Contract hash not configured');
    }

    const stateRootHash = await this.getStateRootHash();

    return this.rpcCall('state_get_dictionary_item', [
      {
        state_identifier: { StateRootHash: stateRootHash },
        dictionary_identifier: {
          ContractNamedKey: {
            key: this.contractHash,
            dictionary_name: 'transitions',
            dictionary_item_key: workflowId,
          },
        },
      },
    ]);
  }

  async queryWorkflowCount(): Promise<string> {
    if (!this.contractHash) {
      throw new Error('Contract hash not configured');
    }

    const stateRootHash = await this.getStateRootHash();

    const result = await this.rpcCall<{ stored_value?: { CLValue?: { parsed: string } } }>(
      'state_get_item',
      [
        {
          state_identifier: { StateRootHash: stateRootHash },
          key: this.contractHash,
          path: ['workflow_count'],
        },
      ]
    );

    return result?.stored_value?.CLValue?.parsed || '0';
  }

  // ==========================================================================
  // Sidecar-specific methods
  // ==========================================================================

  /**
   * Get Sidecar health status.
   */
  async getHealth(): Promise<SidecarHealth> {
    try {
      // Check if we can get the latest block
      const block = await this.getLatestBlock();
      
      // Try to get admin metrics if available
      let metrics: Record<string, unknown> | null = null;
      if (this.adminUrl) {
        try {
          const metricsResponse = await fetch(`${this.adminUrl}/metrics`, {
            signal: AbortSignal.timeout(2000),
          });
          if (metricsResponse.ok) {
            metrics = { raw: await metricsResponse.text() };
          }
        } catch {
          // Metrics endpoint optional
        }
      }

      return {
        connected: true,
        blockHeight: block.header.height,
        metrics,
      };
    } catch (error) {
      logger.warn({ error: (error as Error).message }, 'Sidecar health check failed');
      return {
        connected: false,
        blockHeight: null,
        metrics: null,
      };
    }
  }

  /**
   * Get SSE URL for event subscriptions.
   */
  getSSEUrl(): string {
    return this.sseUrl;
  }

  /**
   * Get admin URL for metrics.
   */
  getAdminUrl(): string {
    return this.adminUrl;
  }
}
