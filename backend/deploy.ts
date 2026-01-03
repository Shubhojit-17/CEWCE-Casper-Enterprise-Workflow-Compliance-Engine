/**
 * CEWCE Contract Deployment Script
 * 
 * Deploys the workflow contract to Casper Testnet using casper-js-sdk.
 * This script bypasses the need for casper-client CLI on Windows.
 * 
 * Uses CSPR.cloud infrastructure as recommended by Casper Hackathon guide.
 * 
 * Prerequisites:
 *   1. Get your free API key from https://console.cspr.build/
 *   2. Fund your account via https://testnet.cspr.live/faucet
 *   3. Set environment variables or create .env.deploy file
 * 
 * Usage: 
 *   npx ts-node deploy.ts
 *   # or with env vars:
 *   CSPR_CLOUD_ACCESS_TOKEN=your-token npx ts-node deploy.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { createRequire } from 'module';

// ESM compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ESM compatible require (for casper-js-sdk CJS module)
const require = createRequire(import.meta.url);

// Load environment variables from .env.deploy if present
config({ path: path.join(__dirname, '.env.deploy') });

// ============================================================================
// Types
// ============================================================================

interface DeployConfig {
  /** CSPR.cloud RPC endpoint - requires authorization */
  nodeUrl: string;
  /** CSPR.cloud access token from console.cspr.build */
  accessToken: string;
  /** Chain name (casper-test for testnet, casper for mainnet) */
  chainName: string;
  /** Payment amount in motes (1 CSPR = 1,000,000,000 motes) */
  paymentAmount: string;
  /** Path to compiled WASM contract */
  wasmPath: string;
  /** Path to deployer's secret key PEM file */
  secretKeyPath: string;
  /** Timeout for waiting for deploy confirmation (ms) */
  deployTimeout: number;
  /** Polling interval for deploy status (ms) */
  pollInterval: number;
}

interface DeployResult {
  success: boolean;
  deployHash?: string;
  contractHash?: string;
  blockHash?: string;
  cost?: string;
  errorMessage?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG: DeployConfig = {
  // CSPR.cloud Testnet RPC endpoint (requires authorization)
  // Fallback endpoints if CSPR.cloud is unavailable
  nodeUrl: process.env.CASPER_NODE_URL || 'https://node.testnet.cspr.cloud/rpc',
  
  // CSPR.cloud access token - get yours at https://console.cspr.build/
  // The demo token has limited capabilities
  accessToken: process.env.CSPR_CLOUD_ACCESS_TOKEN || '55f79117-fc4d-4d60-9956-65423f39a06a',
  
  // Chain name (casper-test for testnet, casper for mainnet)
  chainName: process.env.CASPER_CHAIN_NAME || 'casper-test',
  
  // Payment amount in motes (1 CSPR = 1,000,000,000 motes)
  // 200 CSPR should be sufficient for contract deployment
  paymentAmount: process.env.PAYMENT_AMOUNT || '200000000000',
  
  // Paths - adjust these based on your project structure
  wasmPath: path.resolve(__dirname, '../contracts/target/wasm32-unknown-unknown/release/workflow-contract.wasm'),
  secretKeyPath: process.env.DEPLOYER_SECRET_KEY || path.resolve(__dirname, '../casper_deployer/secret_key.pem'),
  
  // Timeout for waiting for deploy confirmation (5 minutes)
  deployTimeout: 300000,
  
  // Polling interval for deploy status (10 seconds)
  pollInterval: 10000,
};

// Alternative RPC endpoints (in case CSPR.cloud is unavailable)
const FALLBACK_ENDPOINTS = [
  'https://node.testnet.cspr.cloud/rpc',    // CSPR.cloud (requires auth)
  'http://3.208.91.63:7777/rpc',            // Public testnet node #1
  'http://52.35.59.254:7777/rpc',           // Public testnet node #2
  'http://18.224.190.117:7777/rpc',         // Public testnet node #3
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format motes to CSPR for display
 */
function motesToCspr(motes: string | bigint): string {
  return (BigInt(motes) / BigInt(1_000_000_000)).toString();
}

/**
 * Create HTTP client with authorization for CSPR.cloud
 */
async function makeRpcRequest(
  url: string, 
  method: string, 
  params: any[], 
  accessToken?: string
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Add authorization header for CSPR.cloud
  if (accessToken && url.includes('cspr.cloud')) {
    headers['Authorization'] = accessToken;
  }
  
  const body = JSON.stringify({
    jsonrpc: '2.0',
    method,
    params,
    id: Date.now(),
  });
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const json = await response.json();
  
  if (json.error) {
    throw new Error(`RPC Error: ${json.error.message || JSON.stringify(json.error)}`);
  }
  
  return json.result;
}

/**
 * Test connectivity to an RPC endpoint
 */
async function testEndpoint(url: string, accessToken?: string): Promise<boolean> {
  try {
    const result = await makeRpcRequest(url, 'info_get_status', [], accessToken);
    return !!result?.api_version;
  } catch (error) {
    return false;
  }
}

/**
 * Find a working RPC endpoint
 */
async function findWorkingEndpoint(accessToken: string): Promise<string | null> {
  console.log('🔍 Testing RPC endpoints...\n');
  
  for (const endpoint of [CONFIG.nodeUrl, ...FALLBACK_ENDPOINTS]) {
    process.stdout.write(`   Testing ${endpoint}... `);
    const works = await testEndpoint(endpoint, accessToken);
    console.log(works ? '✅' : '❌');
    if (works) {
      return endpoint;
    }
  }
  
  return null;
}

// ============================================================================
// Casper SDK Functions (using raw RPC calls for Windows compatibility)
// ============================================================================

/**
 * Load keypair from PEM file
 */
function loadKeyPair(secretKeyPath: string): any {
  // Dynamic import to handle ESM/CJS compatibility
  const { Keys } = require('casper-js-sdk');
  
  const pemContent = fs.readFileSync(secretKeyPath, 'utf8');
  
  // Check key type from PEM header
  if (pemContent.includes('EC PRIVATE KEY') || pemContent.includes('secp256k1')) {
    return Keys.Secp256K1.loadKeyPairFromPrivateFile(secretKeyPath);
  } else {
    return Keys.Ed25519.loadKeyPairFromPrivateFile(secretKeyPath);
  }
}

/**
 * Build a contract deployment Deploy object
 */
function buildContractDeploy(
  keyPair: any,
  wasmBytes: Uint8Array,
  chainName: string,
  paymentAmount: string
): any {
  const { DeployUtil, RuntimeArgs } = require('casper-js-sdk');
  
  // Create deploy parameters
  const deployParams = new DeployUtil.DeployParams(
    keyPair.publicKey,
    chainName,
    1,       // gasPrice
    1800000  // ttl (30 minutes in ms)
  );
  
  // Create session (module bytes with the WASM)
  const session = DeployUtil.ExecutableDeployItem.newModuleBytes(
    wasmBytes,
    RuntimeArgs.fromMap({})  // No constructor arguments
  );
  
  // Create payment
  const payment = DeployUtil.standardPayment(paymentAmount);
  
  // Build the deploy
  return DeployUtil.makeDeploy(deployParams, session, payment);
}

/**
 * Sign a deploy with the given keypair
 */
function signDeploy(deploy: any, keyPair: any): any {
  const { DeployUtil } = require('casper-js-sdk');
  return DeployUtil.signDeploy(deploy, keyPair);
}

/**
 * Convert deploy to JSON for RPC submission
 */
function deployToJson(deploy: any): any {
  const { DeployUtil } = require('casper-js-sdk');
  return DeployUtil.deployToJson(deploy);
}

/**
 * Submit deploy to the network
 */
async function submitDeploy(
  url: string, 
  deploy: any, 
  accessToken: string
): Promise<string> {
  const deployJson = deployToJson(deploy);
  const result = await makeRpcRequest(url, 'account_put_deploy', [deployJson.deploy], accessToken);
  return result.deploy_hash;
}

/**
 * Get deploy info from the network
 */
async function getDeployInfo(
  url: string, 
  deployHash: string, 
  accessToken: string
): Promise<any> {
  return makeRpcRequest(url, 'info_get_deploy', [deployHash], accessToken);
}

/**
 * Wait for deploy to be processed and return result
 */
async function waitForDeploy(
  url: string,
  deployHash: string, 
  accessToken: string,
  timeoutMs: number, 
  pollInterval: number
): Promise<DeployResult> {
  const startTime = Date.now();
  let lastError: Error | null = null;
  
  console.log('\n   Polling for deploy status...');
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const deployInfo = await getDeployInfo(url, deployHash, accessToken);
      const executionResults = deployInfo.execution_results;
      
      if (executionResults && executionResults.length > 0) {
        const execution = executionResults[0];
        
        if (execution.result.Success) {
          // Extract contract hash from named keys or transforms
          let contractHash: string | undefined;
          const transforms = execution.result.Success.effect?.transforms || [];
          
          for (const transform of transforms) {
            const key = transform.key;
            const transformData = transform.transform;
            
            // Look for WriteContract or contract-related transforms
            if (key && key.startsWith('hash-')) {
              if (transformData === 'WriteContract' || 
                  (typeof transformData === 'object' && transformData.WriteContract)) {
                contractHash = key;
                break;
              }
            }
            
            // Also check for AddKeys which might contain the contract hash
            if (typeof transformData === 'object' && transformData.AddKeys) {
              for (const addedKey of transformData.AddKeys) {
                if (addedKey.key && addedKey.key.startsWith('hash-')) {
                  contractHash = addedKey.key;
                  break;
                }
              }
            }
          }
          
          return {
            success: true,
            deployHash,
            blockHash: execution.block_hash,
            cost: execution.result.Success.cost,
            contractHash,
          };
        } else if (execution.result.Failure) {
          return {
            success: false,
            deployHash,
            blockHash: execution.block_hash,
            errorMessage: execution.result.Failure.error_message,
            cost: execution.result.Failure.cost,
          };
        }
      }
    } catch (error: any) {
      lastError = error;
      // Deploy not found yet, continue polling
    }
    
    process.stdout.write('.');
    await sleep(pollInterval);
  }
  
  return {
    success: false,
    deployHash,
    errorMessage: `Timeout waiting for deploy. Last error: ${lastError?.message || 'None'}`,
  };
}

// ============================================================================
// Main Deployment Function
// ============================================================================

async function deploy(): Promise<DeployResult> {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           CEWCE Contract Deployment Script                     ║');
  console.log('║           Casper Testnet - Windows Compatible                  ║');
  console.log('║           Using CSPR.cloud Infrastructure                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // -------------------------------------------------------------------------
  // Step 1: Validate Prerequisites
  // -------------------------------------------------------------------------
  console.log('Step 1: Validating prerequisites...\n');
  
  // Check WASM file
  if (!fs.existsSync(CONFIG.wasmPath)) {
    console.error('❌ ERROR: Contract WASM not found!');
    console.error(`   Expected path: ${CONFIG.wasmPath}`);
    console.error('\n   Please compile the contract first:');
    console.error('   cd contracts/workflow-contract');
    console.error('   cargo +nightly-2024-10-01 build --release --target wasm32-unknown-unknown\n');
    process.exit(1);
  }
  const wasmStats = fs.statSync(CONFIG.wasmPath);
  console.log(`✅ Contract WASM found: ${CONFIG.wasmPath}`);
  console.log(`   Size: ${wasmStats.size} bytes (${(wasmStats.size / 1024).toFixed(2)} KB)`);
  
  // Check secret key
  if (!fs.existsSync(CONFIG.secretKeyPath)) {
    console.error('❌ ERROR: Secret key not found!');
    console.error(`   Expected path: ${CONFIG.secretKeyPath}`);
    console.error('\n   Please provide a valid Casper secret key file.\n');
    process.exit(1);
  }
  console.log(`✅ Secret key found: ${CONFIG.secretKeyPath}`);
  
  // Check access token
  if (!CONFIG.accessToken || CONFIG.accessToken === '55f79117-fc4d-4d60-9956-65423f39a06a') {
    console.log('\n⚠️  WARNING: Using demo access token with limited capabilities.');
    console.log('   For production, get your own token at https://console.cspr.build/\n');
  }

  // -------------------------------------------------------------------------
  // Step 2: Find Working RPC Endpoint
  // -------------------------------------------------------------------------
  console.log('\nStep 2: Finding working RPC endpoint...\n');
  
  const workingEndpoint = await findWorkingEndpoint(CONFIG.accessToken);
  
  if (!workingEndpoint) {
    console.error('\n❌ ERROR: No working RPC endpoint found!');
    console.error('   Please check your network connection and try again.');
    console.error('   If using CSPR.cloud, verify your access token is valid.\n');
    console.error('   Alternative: Check https://docs.cspr.cloud/ for current endpoints.\n');
    process.exit(1);
  }
  
  console.log(`\n✅ Using RPC endpoint: ${workingEndpoint}`);
  
  // -------------------------------------------------------------------------
  // Step 3: Load Keys and WASM
  // -------------------------------------------------------------------------
  console.log('\nStep 3: Loading keys and contract...\n');
  
  // Load keypair
  let keyPair: any;
  try {
    keyPair = loadKeyPair(CONFIG.secretKeyPath);
    console.log(`✅ Keypair loaded successfully`);
    console.log(`   Public Key: ${keyPair.publicKey.toHex()}`);
    console.log(`   Account Hash: ${keyPair.publicKey.toAccountHashStr()}`);
  } catch (error: any) {
    console.error('❌ ERROR: Failed to load keypair:', error.message);
    process.exit(1);
  }
  
  // Load WASM
  const wasmBuffer = fs.readFileSync(CONFIG.wasmPath);
  console.log(`✅ Contract WASM loaded: ${wasmBuffer.length} bytes`);
  
  // -------------------------------------------------------------------------
  // Step 4: Build the Deploy
  // -------------------------------------------------------------------------
  console.log('\nStep 4: Building deploy...\n');
  
  console.log('   Configuration:');
  console.log(`      Chain: ${CONFIG.chainName}`);
  console.log(`      Payment: ${CONFIG.paymentAmount} motes (${motesToCspr(CONFIG.paymentAmount)} CSPR)`);
  
  const deploy = buildContractDeploy(
    keyPair,
    wasmBuffer,
    CONFIG.chainName,
    CONFIG.paymentAmount
  );
  
  const deployHashHex = Buffer.from(deploy.hash).toString('hex');
  console.log(`\n✅ Deploy created with hash: ${deployHashHex}`);
  
  // -------------------------------------------------------------------------
  // Step 5: Sign the Deploy
  // -------------------------------------------------------------------------
  console.log('\nStep 5: Signing deploy...\n');
  
  const signedDeploy = signDeploy(deploy, keyPair);
  console.log(`✅ Deploy signed by: ${keyPair.publicKey.toHex()}`);
  
  // -------------------------------------------------------------------------
  // Step 6: Submit to Network
  // -------------------------------------------------------------------------
  console.log('\nStep 6: Submitting deploy to network...\n');
  
  let deployHash: string;
  try {
    deployHash = await submitDeploy(workingEndpoint, signedDeploy, CONFIG.accessToken);
    
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    DEPLOY SUBMITTED!                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n   Deploy Hash: ${deployHash}`);
    console.log(`   Explorer: https://testnet.cspr.live/deploy/${deployHash}\n`);
  } catch (error: any) {
    console.error('❌ ERROR: Failed to submit deploy:', error.message);
    process.exit(1);
  }
  
  // -------------------------------------------------------------------------
  // Step 7: Wait for Confirmation
  // -------------------------------------------------------------------------
  console.log('Step 7: Waiting for deploy confirmation...');
  console.log(`   (Timeout: ${CONFIG.deployTimeout / 1000} seconds)\n`);
  
  const result = await waitForDeploy(
    workingEndpoint,
    deployHash,
    CONFIG.accessToken,
    CONFIG.deployTimeout,
    CONFIG.pollInterval
  );
  
  console.log('\n');
  
  if (result.success) {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                  DEPLOYMENT SUCCESSFUL!                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n   Block Hash: ${result.blockHash}`);
    console.log(`   Execution Cost: ${result.cost} motes (${motesToCspr(result.cost || '0')} CSPR)`);
    
    if (result.contractHash) {
      console.log(`\n   Contract Hash: ${result.contractHash}`);
      console.log('\n   ════════════════════════════════════════════════════════════');
      console.log('   Add to your .env files:');
      console.log(`   WORKFLOW_CONTRACT_HASH=${result.contractHash}`);
      console.log(`   VITE_WORKFLOW_CONTRACT_HASH=${result.contractHash}`);
      console.log('   ════════════════════════════════════════════════════════════\n');
    } else {
      console.log('\n   ⚠️  Contract hash not automatically detected.');
      console.log('   Check the deploy on the explorer to find the contract hash.');
      console.log(`   https://testnet.cspr.live/deploy/${deployHash}\n`);
    }
    
    return result;
  } else {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                   DEPLOYMENT FAILED!                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n   Error: ${result.errorMessage}`);
    if (result.cost) {
      console.log(`   Cost burned: ${result.cost} motes`);
    }
    console.log(`\n   Check the deploy for details:`);
    console.log(`   https://testnet.cspr.live/deploy/${deployHash}\n`);
    
    process.exit(1);
  }
}

// ============================================================================
// Entry Point
// ============================================================================

deploy()
  .then(result => {
    if (result?.success) {
      console.log('Deployment complete!');
      process.exit(0);
    }
  })
  .catch(error => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });
