// =============================================================================
// Casper SDK Client
// =============================================================================
// Reference: https://docs.casper.network/developers/dapps/sdk/script-sdk/
// Reference: https://github.com/casper-ecosystem/casper-js-sdk
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
import { config } from './config.js';
import { logger } from './logger.js';

// Type aliases for SDK types
type ContractType = InstanceType<typeof Contracts.Contract>;
type DeployType = ReturnType<typeof DeployUtil.makeDeploy>;

// Custom fetch function that adds authorization header for CSPR.cloud
async function rpcFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (config.csprCloudAccessToken) {
    headers['Authorization'] = config.csprCloudAccessToken;
  }
  
  return fetch(url, { ...options, headers });
}

// Custom JSON-RPC call for direct RPC requests
async function jsonRpcCall(method: string, params: unknown[] = []): Promise<unknown> {
  const body = JSON.stringify({
    id: Date.now(),
    jsonrpc: '2.0',
    method,
    params,
  });
  
  logger.debug({ method, url: config.casperNodeUrl }, 'Making RPC call');
  
  const response = await rpcFetch(config.casperNodeUrl, {
    method: 'POST',
    body,
  });
  
  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, statusText: response.statusText, body: text }, 'RPC fetch failed');
    throw new Error(`RPC request failed: ${response.status} ${response.statusText}`);
  }
  
  const responseText = await response.text();
  logger.debug({ responseText: responseText.slice(0, 1000) }, 'RPC raw response');
  
  const result = JSON.parse(responseText) as { error?: { message?: string }; result?: unknown };
  if (result.error) {
    throw new Error(result.error.message || 'RPC Error');
  }
  return result.result;
}

// Initialize Casper client
// Note: CasperClient is the main interface for blockchain interactions
const casperService = new CasperServiceByJsonRPC(config.casperNodeUrl);
export const casperClient = new CasperClient(config.casperNodeUrl);

// Contract client (initialized after contract deployment)
let contractClient: ContractType | null = null;

/**
 * Initialize the contract client with deployed contract hash.
 * Must be called after contract deployment.
 */
export function initializeContractClient(contractHash: string): void {
  if (!contractHash || contractHash === '<PROVIDED_AT_DEPLOYMENT>') {
    logger.warn('Contract hash not configured. Contract interactions will fail.');
    return;
  }

  try {
    contractClient = new Contracts.Contract(casperClient);
    contractClient.setContractHash(contractHash);
    logger.info({ contractHash }, 'Contract client initialized');
  } catch (error) {
    logger.error({ error, contractHash }, 'Failed to initialize contract client');
  }
}

// Initialize on module load if config is available
if (config.workflowContractHash) {
  initializeContractClient(config.workflowContractHash);
}

/**
 * Get the current state root hash from the network.
 */
export async function getStateRootHash(): Promise<string> {
  try {
    // Use custom RPC call with auth header for CSPR.cloud
    const result = await jsonRpcCall('chain_get_block') as {
      // Casper 2.x format
      block_with_signatures?: {
        block?: {
          Version2?: {
            header?: { state_root_hash: string };
          };
        };
      };
      // Casper 1.x format (fallback)
      block?: {
        header?: { state_root_hash: string };
      };
    };
    
    // Try Casper 2.x format first
    const stateRootHash = result?.block_with_signatures?.block?.Version2?.header?.state_root_hash
      // Fallback to Casper 1.x format
      || result?.block?.header?.state_root_hash;
    
    if (!stateRootHash) {
      logger.error({ result: JSON.stringify(result).slice(0, 500) }, 'Invalid block response - cannot find state_root_hash');
      throw new Error('Failed to get latest block - invalid response');
    }
    
    return stateRootHash;
  } catch (error) {
    logger.error({ error: String(error), nodeUrl: config.casperNodeUrl }, 'getStateRootHash failed');
    throw error;
  }
}

/**
 * Get account information for a public key.
 */
export async function getAccountInfo(publicKeyHex: string): Promise<unknown> {
  const publicKey = CLPublicKey.fromHex(publicKeyHex);
  const stateRootHash = await getStateRootHash();
  const accountHash = publicKey.toAccountHashStr();
  
  return casperService.getBlockState(stateRootHash, accountHash, []);
}

/**
 * Get the account balance for a public key.
 */
export async function getAccountBalance(publicKeyHex: string): Promise<string> {
  const publicKey = CLPublicKey.fromHex(publicKeyHex);
  const balance = await casperClient.balanceOfByPublicKey(publicKey);
  return balance.toString();
}

/**
 * Build a deploy for creating a new workflow.
 * The deploy must be signed by the user's wallet before submission.
 */
export function buildCreateWorkflowDeploy(
  senderPublicKeyHex: string,
  templateHash: Uint8Array,
  dataHash: Uint8Array,
  paymentAmount: string = '5000000000' // 5 CSPR default
): DeployType | null {
  if (!contractClient) {
    logger.error('Contract client not initialized');
    return null;
  }

  const senderPublicKey = CLPublicKey.fromHex(senderPublicKeyHex);

  const args = RuntimeArgs.fromMap({
    template_hash: new CLByteArray(templateHash),
    data_hash: new CLByteArray(dataHash),
  });

  const deploy = contractClient.callEntrypoint(
    'create_workflow',
    args,
    senderPublicKey,
    config.casperChainName,
    paymentAmount
  );

  return deploy;
}

/**
 * Build a deploy for transitioning workflow state.
 * The deploy must be signed by the user's wallet before submission.
 */
export function buildTransitionStateDeploy(
  senderPublicKeyHex: string,
  workflowId: string,
  toState: number,
  actorRole: bigint,
  commentHash: Uint8Array,
  paymentAmount: string = '3000000000' // 3 CSPR default
): DeployType | null {
  if (!contractClient) {
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

  const deploy = contractClient.callEntrypoint(
    'transition_state',
    args,
    senderPublicKey,
    config.casperChainName,
    paymentAmount
  );

  return deploy;
}

/**
 * Submit a signed deploy to the network.
 */
export async function submitDeploy(signedDeployJson: unknown): Promise<string> {
  const deploy = DeployUtil.deployFromJson(signedDeployJson as { deploy: unknown });
  
  if (!deploy.ok) {
    throw new Error('Invalid deploy JSON');
  }

  const deployHash = await casperClient.putDeploy(deploy.val);
  logger.info({ deployHash }, 'Deploy submitted to network');
  
  return deployHash;
}

/**
 * Get deploy status and results.
 */
export async function getDeployInfo(deployHash: string): Promise<unknown> {
  return casperService.getDeployInfo(deployHash);
}

/**
 * Wait for a deploy to be processed.
 * Returns the execution result.
 */
export async function waitForDeploy(
  deployHash: string,
  timeoutMs: number = 120000
): Promise<unknown> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const deployInfo = await getDeployInfo(deployHash);
      const info = deployInfo as { execution_results?: Array<{ result: unknown }> };
      
      if (info.execution_results && info.execution_results.length > 0) {
        return info.execution_results[0].result;
      }
    } catch (error) {
      // Deploy not yet processed, continue waiting
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  throw new Error(`Deploy ${deployHash} not processed within timeout`);
}

/**
 * Query workflow state from the contract.
 * Note: This requires the contract to be deployed and hash configured.
 */
export async function queryWorkflowState(workflowId: string): Promise<unknown> {
  if (!contractClient) {
    throw new Error('Contract client not initialized');
  }

  if (!config.workflowContractHash) {
    throw new Error('Contract hash not configured');
  }

  const stateRootHash = await getStateRootHash();
  
  // Query the contract's dictionary for workflow data
  // The exact implementation depends on the contract's storage layout
  try {
    const result = await casperService.getDictionaryItemByName(
      stateRootHash,
      config.workflowContractHash,
      'workflows',
      workflowId
    );
    return result;
  } catch (error) {
    logger.warn({ workflowId, error }, 'Failed to query workflow state');
    return null;
  }
}

/**
 * Query workflow transition history from the contract.
 */
export async function queryWorkflowHistory(workflowId: string): Promise<unknown> {
  if (!contractClient) {
    throw new Error('Contract client not initialized');
  }

  if (!config.workflowContractHash) {
    throw new Error('Contract hash not configured');
  }

  const stateRootHash = await getStateRootHash();
  
  try {
    const result = await casperService.getDictionaryItemByName(
      stateRootHash,
      config.workflowContractHash,
      'transitions',
      workflowId
    );
    return result;
  } catch (error) {
    logger.warn({ workflowId, error }, 'Failed to query workflow history');
    return null;
  }
}

/**
 * Get the current workflow count from the contract.
 */
export async function queryWorkflowCount(): Promise<string> {
  if (!contractClient) {
    throw new Error('Contract client not initialized');
  }

  const stateRootHash = await getStateRootHash();
  
  // Use casperService for queries instead of contractClient
  const result = await casperService.getBlockState(
    stateRootHash,
    config.workflowContractHash || '',
    ['workflow_count']
  );
  
  return result?.CLValue?.data?.toString() || '0';
}

// Export types for use in other modules
export { CLPublicKey, DeployUtil, RuntimeArgs };
