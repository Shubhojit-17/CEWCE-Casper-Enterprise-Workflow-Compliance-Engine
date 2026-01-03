/**
 * CEWCE - Casper Wallet Service
 * 
 * This service provides integration with Casper Signer and Casper Wallet extensions.
 * It handles wallet connection, signing operations, and deploy submissions.
 */

import { CasperClient, CLPublicKey, DeployUtil, RuntimeArgs, CLValueBuilder } from 'casper-js-sdk';

// Casper Wallet/Signer helper type
interface CasperLabsHelper {
  isConnected: () => Promise<boolean>;
  requestConnection: () => Promise<void>;
  disconnectFromSite: () => Promise<void>;
  getActivePublicKey: () => Promise<string>;
  sign: (
    deployJson: { deploy: unknown },
    signingPublicKey: string,
    targetPublicKey?: string
  ) => Promise<{ deploy: unknown }>;
  signMessage: (message: string, signingPublicKey: string) => Promise<string>;
}

// Type for window with casper signer
interface WindowWithCasperSigner {
  casperlabsHelper?: CasperLabsHelper;
}

// Helper to get casper signer from window
const getCasperSigner = (): CasperLabsHelper | undefined => {
  return (window as unknown as WindowWithCasperSigner).casperlabsHelper;
};

// Environment configuration
const CASPER_NODE_URL = import.meta.env.VITE_CASPER_NODE_URL || 'https://testnet.cspr.live/rpc';
const CHAIN_NAME = import.meta.env.VITE_CASPER_CHAIN_NAME || 'casper-test';
const CONTRACT_HASH = import.meta.env.VITE_WORKFLOW_CONTRACT_HASH || '';

// Workflow state constants matching the smart contract
export const WorkflowState = {
  DRAFT: 0,
  PENDING_REVIEW: 1,
  IN_REVIEW: 2,
  PENDING_APPROVAL: 3,
  APPROVED: 10,
  REJECTED: 11,
  ESCALATED: 20,
  CANCELLED: 30,
} as const;

export type WorkflowStateValue = (typeof WorkflowState)[keyof typeof WorkflowState];

export interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  accountHash: string | null;
}

export interface DeployResult {
  deployHash: string;
  success: boolean;
  errorMessage?: string;
}

export class CasperWalletService {
  private client: CasperClient;
  private static instance: CasperWalletService;

  private constructor() {
    this.client = new CasperClient(CASPER_NODE_URL);
  }

  static getInstance(): CasperWalletService {
    if (!CasperWalletService.instance) {
      CasperWalletService.instance = new CasperWalletService();
    }
    return CasperWalletService.instance;
  }

  /**
   * Check if Casper Signer extension is installed
   */
  isSignerInstalled(): boolean {
    return typeof getCasperSigner() !== 'undefined';
  }

  /**
   * Connect to Casper Signer
   */
  async connect(): Promise<WalletState> {
    if (!this.isSignerInstalled()) {
      throw new Error(
        'Casper Signer is not installed. Please install the extension from https://chrome.google.com/webstore/detail/casper-signer'
      );
    }

    const signer = getCasperSigner()!;

    // Check if already connected
    const isConnected = await signer.isConnected();
    if (!isConnected) {
      await signer.requestConnection();
    }

    // Get the active public key
    const publicKeyHex = await signer.getActivePublicKey();
    const publicKey = CLPublicKey.fromHex(publicKeyHex);
    const accountHash = publicKey.toAccountHashStr();

    return {
      isConnected: true,
      publicKey: publicKeyHex,
      accountHash,
    };
  }

  /**
   * Disconnect from Casper Signer
   */
  async disconnect(): Promise<void> {
    if (!this.isSignerInstalled()) return;
    await getCasperSigner()!.disconnectFromSite();
  }

  /**
   * Get connection status
   */
  async getConnectionStatus(): Promise<WalletState> {
    if (!this.isSignerInstalled()) {
      return { isConnected: false, publicKey: null, accountHash: null };
    }

    try {
      const isConnected = await getCasperSigner()!.isConnected();
      if (!isConnected) {
        return { isConnected: false, publicKey: null, accountHash: null };
      }

      const publicKeyHex = await getCasperSigner()!.getActivePublicKey();
      const publicKey = CLPublicKey.fromHex(publicKeyHex);
      const accountHash = publicKey.toAccountHashStr();

      return { isConnected: true, publicKey: publicKeyHex, accountHash };
    } catch (error) {
      console.error('Failed to get connection status:', error);
      return { isConnected: false, publicKey: null, accountHash: null };
    }
  }

  /**
   * Get account balance
   */
  async getBalance(accountHash: string): Promise<string> {
    try {
      const stateRootHash = await this.client.nodeClient.getStateRootHash();
      const balanceUref = await this.client.nodeClient.getAccountBalanceUrefByPublicKeyHash(
        stateRootHash,
        accountHash.replace('account-hash-', '')
      );
      const balance = await this.client.nodeClient.getAccountBalance(stateRootHash, balanceUref);
      return balance.toString();
    } catch (error) {
      console.error('Failed to get balance:', error);
      return '0';
    }
  }

  /**
   * Sign a message using Casper Signer
   */
  async signMessage(message: string, publicKeyHex: string): Promise<string> {
    if (!this.isSignerInstalled()) {
      throw new Error('Casper Signer is not installed');
    }

    return getCasperSigner()!.signMessage(message, publicKeyHex);
  }

  /**
   * Create a workflow transition deploy
   */
  createWorkflowTransitionDeploy(
    publicKeyHex: string,
    workflowId: string,
    newState: WorkflowStateValue,
    comment: string = ''
  ): DeployUtil.Deploy {
    if (!CONTRACT_HASH) {
      throw new Error('Workflow contract hash not configured');
    }

    const publicKey = CLPublicKey.fromHex(publicKeyHex);

    const args = RuntimeArgs.fromMap({
      workflow_id: CLValueBuilder.string(workflowId),
      new_state: CLValueBuilder.u8(newState),
      comment: CLValueBuilder.string(comment),
    });

    const deploy = DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(publicKey, CHAIN_NAME, 1, 1800000),
      DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Uint8Array.from(Buffer.from(CONTRACT_HASH.replace('hash-', ''), 'hex')),
        'transition_state',
        args
      ),
      DeployUtil.standardPayment(3000000000) // 3 CSPR
    );

    return deploy;
  }

  /**
   * Create a new workflow deploy
   */
  createNewWorkflowDeploy(
    publicKeyHex: string,
    workflowId: string,
    templateId: string,
    metadata: Record<string, string> = {}
  ): DeployUtil.Deploy {
    if (!CONTRACT_HASH) {
      throw new Error('Workflow contract hash not configured');
    }

    const publicKey = CLPublicKey.fromHex(publicKeyHex);

    const args = RuntimeArgs.fromMap({
      workflow_id: CLValueBuilder.string(workflowId),
      template_id: CLValueBuilder.string(templateId),
      metadata: CLValueBuilder.string(JSON.stringify(metadata)),
    });

    const deploy = DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(publicKey, CHAIN_NAME, 1, 1800000),
      DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Uint8Array.from(Buffer.from(CONTRACT_HASH.replace('hash-', ''), 'hex')),
        'create_workflow',
        args
      ),
      DeployUtil.standardPayment(5000000000) // 5 CSPR
    );

    return deploy;
  }

  /**
   * Sign and submit a deploy
   */
  async signAndSubmitDeploy(
    deploy: DeployUtil.Deploy,
    publicKeyHex: string
  ): Promise<DeployResult> {
    if (!this.isSignerInstalled()) {
      throw new Error('Casper Signer is not installed');
    }

    try {
      // Convert deploy to JSON for signing
      const deployJson = DeployUtil.deployToJson(deploy);
      
      // Sign with Casper Signer
      const signedDeployJson = await getCasperSigner()!.sign(
        deployJson,
        publicKeyHex
      );

      // Parse signed deploy
      const signedDeploy = DeployUtil.deployFromJson(signedDeployJson).unwrap();

      // Submit to network
      const result = await this.client.putDeploy(signedDeploy);

      return {
        deployHash: result,
        success: true,
      };
    } catch (error) {
      console.error('Failed to sign and submit deploy:', error);
      return {
        deployHash: '',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get deploy status
   */
  async getDeployStatus(deployHash: string): Promise<{
    status: 'pending' | 'success' | 'failed';
    blockHash?: string;
    cost?: string;
    errorMessage?: string;
  }> {
    try {
      const result = await this.client.getDeploy(deployHash);
      const executionResults = result[1].execution_results;

      if (!executionResults || executionResults.length === 0) {
        return { status: 'pending' };
      }

      const execution = executionResults[0];
      if ('Success' in execution.result && execution.result.Success) {
        return {
          status: 'success',
          blockHash: execution.block_hash,
          cost: String(execution.result.Success.cost),
        };
      } else {
        return {
          status: 'failed',
          blockHash: execution.block_hash,
          errorMessage: execution.result.Failure?.error_message || 'Unknown error',
        };
      }
    } catch (error) {
      // Deploy not found = still pending
      if ((error as Error).message?.includes('not found')) {
        return { status: 'pending' };
      }
      throw error;
    }
  }

  /**
   * Wait for deploy confirmation
   */
  async waitForDeployConfirmation(
    deployHash: string,
    timeoutMs: number = 300000, // 5 minutes
    pollIntervalMs: number = 5000 // 5 seconds
  ): Promise<{
    status: 'success' | 'failed' | 'timeout';
    blockHash?: string;
    cost?: string;
    errorMessage?: string;
  }> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getDeployStatus(deployHash);

      if (status.status === 'success') {
        return { status: 'success', blockHash: status.blockHash, cost: status.cost };
      }
      if (status.status === 'failed') {
        return { status: 'failed', blockHash: status.blockHash, errorMessage: status.errorMessage };
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return { status: 'timeout', errorMessage: 'Deploy confirmation timed out' };
  }

  /**
   * Get network status
   */
  async getNetworkStatus(): Promise<{
    isOnline: boolean;
    latestBlockHeight?: number;
    chainName?: string;
  }> {
    try {
      const status = await this.client.nodeClient.getStatus();
      return {
        isOnline: true,
        latestBlockHeight: status.last_added_block_info?.height,
        chainName: status.chainspec_name,
      };
    } catch (error) {
      return { isOnline: false };
    }
  }
}

// Export singleton instance
export const casperWallet = CasperWalletService.getInstance();
