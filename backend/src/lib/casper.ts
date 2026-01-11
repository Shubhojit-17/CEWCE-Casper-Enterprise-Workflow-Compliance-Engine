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
  Keys,
} = CasperSDK;
import { readFileSync, existsSync } from 'fs';
import { config } from './config.js';
import { logger } from './logger.js';

// Type aliases for SDK types
type ContractType = InstanceType<typeof Contracts.Contract>;
type DeployType = ReturnType<typeof DeployUtil.makeDeploy>;
type AsymmetricKey = InstanceType<typeof Keys.Ed25519> | InstanceType<typeof Keys.Secp256K1>;

// Deployer key for server-side operations (template registration)
let deployerKeyPair: AsymmetricKey | null = null;
let deployerPublicKeyHex: string | null = null;

// Fixed paths for deployer keys (written by docker-entrypoint.sh from env vars)
const DEPLOYER_SECRET_KEY_PATH = '/tmp/casper/secret_key.pem';
const DEPLOYER_PUBLIC_KEY_PATH = '/tmp/casper/public_key.pem';
const DEPLOYER_PUBLIC_KEY_HEX_PATH = '/tmp/casper/public_key_hex';

/**
 * Load the deployer key pair for server-side signing operations.
 * Keys are loaded from /tmp/casper/ directory (written by docker-entrypoint.sh).
 */
function loadDeployerKey(): void {
  if (!existsSync(DEPLOYER_SECRET_KEY_PATH) || !existsSync(DEPLOYER_PUBLIC_KEY_PATH)) {
    logger.warn('Deployer key files not found at /tmp/casper/. Server-side template registration will be unavailable.');
    return;
  }

  try {
    // Read public key hex for logging and storage
    let publicKeyHex = '';
    if (existsSync(DEPLOYER_PUBLIC_KEY_HEX_PATH)) {
      publicKeyHex = readFileSync(DEPLOYER_PUBLIC_KEY_HEX_PATH, 'utf-8').trim();
    }

    // Load Secp256K1 key pair from files
    deployerKeyPair = Keys.Secp256K1.parseKeyFiles(
      DEPLOYER_PUBLIC_KEY_PATH,
      DEPLOYER_SECRET_KEY_PATH
    );
    
    // Get public key hex from loaded key if not read from file
    if (!publicKeyHex) {
      publicKeyHex = deployerKeyPair.publicKey.toHex();
    }
    
    deployerPublicKeyHex = publicKeyHex;
    logger.info({ publicKey: publicKeyHex.slice(0, 16) + '...' }, 'Deployer key loaded successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to load deployer key from /tmp/casper/');
  }
}

// Load deployer key on module initialization
loadDeployerKey();

/**
 * Get the deployer public key hex if available.
 */
export function getDeployerPublicKey(): string | null {
  return deployerPublicKeyHex;
}

/**
 * Check if server-side signing is available.
 */
export function isServerSigningAvailable(): boolean {
  return deployerKeyPair !== null && deployerPublicKeyHex !== null;
}

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
 * Uses Casper 2.x query_balance RPC method.
 */
export async function getAccountBalance(publicKeyHex: string): Promise<string> {
  try {
    logger.info(`Fetching balance for public key: ${publicKeyHex}`);
    
    // Use query_balance RPC method (Casper 2.x compatible)
    const response = await fetch(config.casperNodeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'query_balance',
        id: Date.now(),
        params: {
          purse_identifier: {
            main_purse_under_public_key: publicKeyHex
          }
        }
      })
    });
    
    const data = await response.json() as { 
      result?: { balance?: string }; 
      error?: { message?: string } 
    };
    
    if (data.error) {
      logger.error(`RPC error fetching balance: ${data.error.message}`);
      throw new Error(data.error.message || 'Failed to fetch balance');
    }
    
    const balance = data.result?.balance || '0';
    logger.info(`Balance fetched successfully: ${balance}`);
    return balance;
  } catch (error) {
    logger.error(`Error fetching balance for ${publicKeyHex}:`, error);
    throw error;
  }
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
 * Build a deploy for registering a workflow template on-chain.
 * This registers the template definition with the contract.
 * The returned workflow_id (U256) becomes the template's onChainWorkflowId.
 * 
 * @param senderPublicKeyHex - Public key of the deployer (system/admin account)
 * @param templateHash - SHA-256 hash of the workflow template definition
 * @param metadataHash - SHA-256 hash of template metadata (name, version, etc.)
 * @param paymentAmount - CSPR payment amount (default 5 CSPR)
 * @returns Deploy object or null if contract not initialized
 */
export function buildRegisterWorkflowTemplateDeploy(
  senderPublicKeyHex: string,
  templateHash: Uint8Array,
  metadataHash: Uint8Array,
  paymentAmount: string = '5000000000' // 5 CSPR default
): DeployType | null {
  if (!contractClient) {
    logger.error('Contract client not initialized');
    return null;
  }

  const senderPublicKey = CLPublicKey.fromHex(senderPublicKeyHex);

  // Use create_workflow entry point with template hash and metadata hash
  // The contract returns a workflow_id (U256) which we store as onChainWorkflowId
  const args = RuntimeArgs.fromMap({
    template_hash: new CLByteArray(templateHash),
    data_hash: new CLByteArray(metadataHash),
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

  // Convert bigint to string for CLValueBuilder.u64 to avoid Math.sign() error
  const actorRoleStr = actorRole.toString();

  const args = RuntimeArgs.fromMap({
    workflow_id: CLValueBuilder.u256(workflowId),
    to_state: CLValueBuilder.u8(toState),
    actor_role: CLValueBuilder.u64(actorRoleStr),
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
 * Build a deploy for transitioning workflow state using server deployer key.
 * This is for server-side automated transitions.
 * 
 * @param workflowId - The on-chain workflow ID (U256)
 * @param toState - Target state (u8)
 * @param actorRole - Role bitmask of the actor (u64)
 * @param commentHash - SHA-256 hash of comment (32 bytes)
 * @param paymentAmount - CSPR payment amount (default 3 CSPR)
 * @returns Deploy object or null if not available
 */
export function buildTransitionStateDeployServerSide(
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

  if (!deployerKeyPair || !deployerPublicKeyHex) {
    logger.error('Server deployer key not available');
    return null;
  }

  const senderPublicKey = CLPublicKey.fromHex(deployerPublicKeyHex);

  // Convert bigint to string for CLValueBuilder.u64
  const actorRoleStr = actorRole.toString();

  const args = RuntimeArgs.fromMap({
    workflow_id: CLValueBuilder.u256(workflowId),
    to_state: CLValueBuilder.u8(toState),
    actor_role: CLValueBuilder.u64(actorRoleStr),
    comment_hash: new CLByteArray(commentHash),
  });

  const deploy = contractClient.callEntrypoint(
    'transition_state',
    args,
    senderPublicKey,
    config.casperChainName,
    paymentAmount
  );

  logger.debug({ workflowId, toState }, 'Built server-side transition deploy');
  return deploy;
}

/**
 * Submit a signed deploy to the network.
 */
export async function submitDeploy(signedDeployJson: unknown): Promise<string> {
  // Handle various input formats from wallet signing
  let deployInput = signedDeployJson as Record<string, unknown>;
  
  // Log the input for debugging
  logger.debug({ signedDeployJson: JSON.stringify(deployInput).substring(0, 500) }, 'submitDeploy input');
  
  // If wrapped in { deploy: {...} }, use as-is
  // If just the deploy object, wrap it
  if (!deployInput.deploy && deployInput.hash) {
    // It's a raw deploy object without the wrapper
    deployInput = { deploy: deployInput };
  }
  
  const deploy = DeployUtil.deployFromJson(deployInput as { deploy: unknown });
  
  if (!deploy.ok) {
    logger.error({ error: deploy.val, input: JSON.stringify(deployInput).substring(0, 500) }, 'Failed to parse deploy JSON');
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
 * Includes RPC failsafe handling for network issues.
 */
export async function queryWorkflowState(workflowId: string): Promise<unknown> {
  if (!contractClient) {
    throw new Error('Contract client not initialized');
  }

  if (!config.workflowContractHash) {
    throw new Error('Contract hash not configured');
  }

  // RPC failsafe: retry with exponential backoff
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const stateRootHash = await getStateRootHash();
      
      // Query the contract's dictionary for workflow data
      const result = await casperService.getDictionaryItemByName(
        stateRootHash,
        config.workflowContractHash,
        'workflows',
        workflowId
      );
      return result;
    } catch (error) {
      lastError = error as Error;
      logger.warn({ workflowId, attempt, error: lastError.message }, 'RPC query failed, retrying...');
      
      // Exponential backoff: 1s, 2s, 4s
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  logger.error({ workflowId, error: lastError?.message }, 'Failed to query workflow state after retries');
  return null;
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

/**
 * Sign a deploy server-side using the deployer key.
 * Used for backend operations like template registration.
 * 
 * @param deploy - The unsigned deploy to sign
 * @returns Signed deploy or null if signing unavailable
 */
export function signDeployServerSide(deploy: DeployType): DeployType | null {
  if (!deployerKeyPair) {
    logger.error('Deployer key not available for server-side signing');
    return null;
  }

  try {
    const signedDeploy = DeployUtil.signDeploy(deploy, deployerKeyPair);
    logger.debug({ deployHash: signedDeploy.hash.toString() }, 'Deploy signed server-side');
    return signedDeploy;
  } catch (error) {
    logger.error({ error }, 'Failed to sign deploy server-side');
    return null;
  }
}

/**
 * Sign and submit a deploy server-side.
 * Used for automated backend operations.
 * 
 * @param deploy - The unsigned deploy to sign and submit
 * @returns Deploy hash or null on failure
 */
export async function signAndSubmitDeployServerSide(deploy: DeployType): Promise<string | null> {
  const signedDeploy = signDeployServerSide(deploy);
  if (!signedDeploy) {
    return null;
  }

  try {
    const deployHash = await casperClient.putDeploy(signedDeploy);
    logger.info({ deployHash }, 'Server-signed deploy submitted to network');
    return deployHash;
  } catch (error) {
    logger.error({ error }, 'Failed to submit server-signed deploy');
    return null;
  }
}

/**
 * Register a workflow template on-chain.
 * This is a server-side operation that uses the deployer key.
 * 
 * @param templateHash - SHA-256 hash of the template definition (states + transitions)
 * @param metadataHash - SHA-256 hash of template metadata (name, version, description)
 * @returns Object with deployHash or error
 */
export async function registerWorkflowTemplateOnChain(
  templateHash: Uint8Array,
  metadataHash: Uint8Array
): Promise<{ success: boolean; deployHash?: string; error?: string }> {
  // Check prerequisites
  if (!contractClient) {
    return { success: false, error: 'Contract client not initialized' };
  }

  if (!isServerSigningAvailable()) {
    return { success: false, error: 'Server-side signing not available (deployer key not loaded)' };
  }

  if (!deployerPublicKeyHex) {
    return { success: false, error: 'Deployer public key not available' };
  }

  // Build the deploy
  const deploy = buildRegisterWorkflowTemplateDeploy(
    deployerPublicKeyHex,
    templateHash,
    metadataHash
  );

  if (!deploy) {
    return { success: false, error: 'Failed to build registration deploy' };
  }

  // Sign and submit
  const deployHash = await signAndSubmitDeployServerSide(deploy);
  if (!deployHash) {
    return { success: false, error: 'Failed to sign and submit deploy' };
  }

  logger.info({ deployHash }, 'Workflow template registration deploy submitted');
  return { success: true, deployHash };
}

/**
 * Create a workflow instance on-chain using server-side signing.
 * This is called when a user creates a workflow instance - we use server key
 * to avoid requiring user wallet signing for instance creation.
 * 
 * @param instanceId - Database instance ID for logging
 * @param templateHash - SHA-256 hash of the template reference
 * @param dataHash - SHA-256 hash of instance data
 * @returns Object with deployHash or error
 */
export async function createWorkflowInstanceOnChain(
  instanceId: string,
  templateHash: Uint8Array,
  dataHash: Uint8Array
): Promise<{ success: boolean; deployHash?: string; error?: string }> {
  // Check prerequisites
  if (!contractClient) {
    return { success: false, error: 'Contract client not initialized' };
  }

  if (!isServerSigningAvailable()) {
    return { success: false, error: 'Server-side signing not available (deployer key not loaded)' };
  }

  if (!deployerPublicKeyHex) {
    return { success: false, error: 'Deployer public key not available' };
  }

  // Build the deploy using the same create_workflow entry point
  const deploy = buildRegisterWorkflowTemplateDeploy(
    deployerPublicKeyHex,
    templateHash,
    dataHash
  );

  if (!deploy) {
    return { success: false, error: 'Failed to build instance creation deploy' };
  }

  // Sign and submit
  const deployHash = await signAndSubmitDeployServerSide(deploy);
  if (!deployHash) {
    return { success: false, error: 'Failed to sign and submit deploy' };
  }

  logger.info({ deployHash, instanceId }, 'Workflow instance creation deploy submitted');
  return { success: true, deployHash };
}

/**
 * Parsed deploy confirmation result - supports both Casper 1.x and 2.x formats.
 */
export interface DeployConfirmationResult {
  status: 'PENDING' | 'SUCCESS' | 'FAILURE';
  blockHash?: string | null;
  blockHeight?: number | null;
  executionCost?: string | null;
  effects?: unknown;
  error?: string | null;
}

/**
 * Parse deploy confirmation from Casper RPC response.
 * Handles both Casper 1.x (execution_results) and 2.x (execution_info) formats.
 * 
 * IMPORTANT: If execution_info exists (Casper 2.x), we do NOT fall through to 1.x logic.
 * 
 * @param deployInfo - Raw deploy info from getDeployInfo RPC call
 * @returns Parsed confirmation result with status, effects, and error details
 */
export function parseDeployConfirmation(deployInfo: unknown): DeployConfirmationResult {
  const info = deployInfo as {
    // Casper 2.x format
    execution_info?: {
      block_hash?: string;
      block_height?: number;
      execution_result?: {
        Success?: {
          effect?: unknown;
          cost?: string;
        };
        Failure?: {
          error_message?: string;
          cost?: string;
        };
        // Version2 wrapper (some RPC responses)
        Version2?: {
          error_message?: string | null;
          consumed?: string;
          cost?: string;
          effects?: unknown;
        };
      };
    };
    // Casper 1.x format
    execution_results?: Array<{
      block_hash?: string;
      result: {
        Success?: {
          effect?: unknown;
          cost?: string;
        };
        Failure?: {
          error_message?: string;
          cost?: string;
        };
      };
    }>;
  };

  // Check Casper 2.x format first (execution_info is present in 2.x)
  if (info.execution_info !== undefined) {
    const execInfo = info.execution_info;
    
    // If execution_result is not yet available, deploy is still pending
    if (!execInfo.execution_result) {
      return { status: 'PENDING' };
    }
    
    const result = execInfo.execution_result;
    const blockHash = execInfo.block_hash || null;
    const blockHeight = execInfo.block_height || null;
    
    // Handle Version2 wrapper format
    if (result.Version2) {
      const v2 = result.Version2;
      const cost = v2.cost || v2.consumed || null;
      
      if (v2.error_message) {
        return {
          status: 'FAILURE',
          blockHash,
          blockHeight,
          executionCost: cost,
          error: v2.error_message,
        };
      }
      
      return {
        status: 'SUCCESS',
        blockHash,
        blockHeight,
        executionCost: cost,
        effects: v2.effects,
      };
    }
    
    // Handle direct Success/Failure format
    if (result.Success) {
      return {
        status: 'SUCCESS',
        blockHash,
        blockHeight,
        executionCost: result.Success.cost || null,
        effects: result.Success.effect,
      };
    }
    
    if (result.Failure) {
      return {
        status: 'FAILURE',
        blockHash,
        blockHeight,
        executionCost: result.Failure.cost || null,
        error: result.Failure.error_message || 'Unknown error',
      };
    }
    
    // execution_result exists but has unexpected format
    return { status: 'PENDING' };
  }

  // Fallback to Casper 1.x format (only if execution_info is NOT present)
  if (info.execution_results && info.execution_results.length > 0) {
    const execResult = info.execution_results[0];
    const result = execResult.result;
    const blockHash = execResult.block_hash || null;
    
    if (result.Success) {
      return {
        status: 'SUCCESS',
        blockHash,
        executionCost: result.Success.cost || null,
        effects: result.Success.effect,
      };
    }
    
    if (result.Failure) {
      return {
        status: 'FAILURE',
        blockHash,
        executionCost: result.Failure.cost || null,
        error: result.Failure.error_message || 'Unknown error',
      };
    }
  }

  // No execution results - deploy is still pending
  return { status: 'PENDING' };
}

/**
 * Extract workflow_id from deploy execution effects.
 * The contract returns workflow_id via runtime::ret which appears in transforms.
 * Works with both Casper 1.x and 2.x effect formats.
 * 
 * @param effects - Execution effects from parseDeployConfirmation
 * @returns The workflow_id as a string (BigInt compatible) or null
 */
export function extractWorkflowIdFromEffects(effects: unknown): string | null {
  if (!effects) {
    return null;
  }
  
  try {
    // Casper 2.x effects format (array of { key, kind })
    if (Array.isArray(effects)) {
      for (const effect of effects) {
        const eff = effect as {
          key?: string;
          kind?: {
            Write?: {
              CLValue?: {
                cl_type?: string;
                bytes?: string;
                parsed?: string | number;
              };
            };
          };
        };
        
        if (eff.kind?.Write?.CLValue) {
          const clValue = eff.kind.Write.CLValue;
          if (clValue.cl_type === 'U256' && clValue.parsed !== undefined) {
            return String(clValue.parsed);
          }
        }
      }
    }
    
    // Casper 1.x effects format (transforms array)
    const effectsObj = effects as {
      transforms?: Array<{
        key: string;
        transform: {
          WriteCLValue?: {
            cl_type?: string;
            bytes?: string;
            parsed?: string | number;
          };
        };
      }>;
    };
    
    if (effectsObj.transforms) {
      for (const transform of effectsObj.transforms) {
        if (transform.transform.WriteCLValue) {
          const clValue = transform.transform.WriteCLValue;
          if (clValue.cl_type === 'U256' && clValue.parsed !== undefined) {
            return String(clValue.parsed);
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error({ error }, 'Failed to extract workflow_id from effects');
    return null;
  }
}

/**
 * Parse the workflow_id from a create_workflow deploy execution result.
 * The contract returns the new workflow_id (U256) on successful execution.
 * 
 * @deprecated Use parseDeployConfirmation + extractWorkflowIdFromEffects instead
 * @param deployInfo - Deploy info from getDeployInfo
 * @returns The workflow_id as a string (BigInt compatible) or null
 */
export function parseWorkflowIdFromDeployResult(deployInfo: unknown): string | null {
  try {
    const info = deployInfo as {
      execution_results?: Array<{
        result: {
          Success?: {
            effect?: {
              transforms?: Array<{
                key: string;
                transform: {
                  WriteCLValue?: {
                    cl_type?: string;
                    bytes?: string;
                    parsed?: string | number;
                  };
                };
              }>;
            };
          };
          Failure?: unknown;
        };
      }>;
    };

    if (!info.execution_results || info.execution_results.length === 0) {
      return null;
    }

    const result = info.execution_results[0].result;
    if (result.Failure) {
      return null;
    }

    // The create_workflow entry point returns workflow_id via runtime::ret
    // In execution_results, this appears in the transforms
    // Look for the return value or the workflow_count increment
    
    // Method 1: Try to find the returned value in transforms
    const transforms = result.Success?.effect?.transforms;
    if (transforms) {
      for (const transform of transforms) {
        if (transform.transform.WriteCLValue) {
          const clValue = transform.transform.WriteCLValue;
          // U256 return value
          if (clValue.cl_type === 'U256' && clValue.parsed !== undefined) {
            return String(clValue.parsed);
          }
        }
      }
    }

    // Method 2: Query the current workflow count (it was incremented)
    // This is a fallback if the return value isn't directly accessible
    logger.warn('Could not parse workflow_id from deploy result directly');
    return null;
  } catch (error) {
    logger.error({ error }, 'Failed to parse workflow_id from deploy result');
    return null;
  }
}

// Export types for use in other modules
export { CLPublicKey, DeployUtil, RuntimeArgs };
