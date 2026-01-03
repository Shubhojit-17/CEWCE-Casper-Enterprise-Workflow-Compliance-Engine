/**
 * CEWCE Contract Deployment Script
 * 
 * Deploys the workflow contract to Casper Testnet using casper-js-sdk.
 * This script bypasses the need for casper-client CLI.
 */

import casperSdk from 'casper-js-sdk';
const { CasperServiceByJsonRPC, DeployUtil, Keys, RuntimeArgs } = casperSdk;

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CASPER_NODE_URL = process.env.CASPER_NODE_URL || 'https://rpc.testnet.casperlabs.io/rpc';
const CHAIN_NAME = process.env.CASPER_CHAIN_NAME || 'casper-test';
const PAYMENT_AMOUNT = process.env.PAYMENT_AMOUNT || '200000000000'; // 200 CSPR

// Paths
const CONTRACT_WASM_PATH = path.resolve(__dirname, '../../../contracts/target/wasm32-unknown-unknown/release/workflow-contract.wasm');
const DEPLOYER_SECRET_KEY_PATH = process.env.DEPLOYER_SECRET_KEY || path.resolve(__dirname, '../../../casper_deployer/secret_key.pem');

async function main() {
  console.log('========================================');
  console.log('CEWCE Contract Deployment');
  console.log('========================================\n');

  // Check for WASM file
  if (!fs.existsSync(CONTRACT_WASM_PATH)) {
    console.error(`Error: Contract WASM not found at ${CONTRACT_WASM_PATH}`);
    console.error('Please compile the contract first with:');
    console.error('  cd contracts/workflow-contract && cargo +nightly-2024-10-01 build --release --target wasm32-unknown-unknown');
    process.exit(1);
  }

  // Check for secret key
  if (!fs.existsSync(DEPLOYER_SECRET_KEY_PATH)) {
    console.error(`Error: Secret key not found at ${DEPLOYER_SECRET_KEY_PATH}`);
    console.error('Please provide a valid secret key file');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  Node URL: ${CASPER_NODE_URL}`);
  console.log(`  Chain Name: ${CHAIN_NAME}`);
  console.log(`  Contract WASM: ${CONTRACT_WASM_PATH}`);
  console.log(`  Payment: ${PAYMENT_AMOUNT} motes (${parseInt(PAYMENT_AMOUNT) / 1_000_000_000} CSPR)\n`);

  try {
    // Load secret key
    console.log('Loading deployer keys...');
    const keyPair = Keys.Ed25519.loadKeyPairFromPrivateFile(DEPLOYER_SECRET_KEY_PATH);
    const publicKey = keyPair.publicKey;
    console.log(`  Deployer Public Key: ${publicKey.toHex()}`);
    console.log(`  Account Hash: ${publicKey.toAccountHashStr()}\n`);

    // Load contract WASM
    console.log('Loading contract WASM...');
    const contractWasm = fs.readFileSync(CONTRACT_WASM_PATH);
    console.log(`  WASM Size: ${contractWasm.length} bytes\n`);

    // Create deploy
    console.log('Creating deploy...');
    const deployParams = new DeployUtil.DeployParams(
      publicKey,
      CHAIN_NAME,
      1, // Gas price
      1800000 // TTL: 30 minutes
    );

    // Empty runtime args for installation
    const runtimeArgs = RuntimeArgs.fromMap({});

    // Create module bytes for the WASM
    const session = DeployUtil.ExecutableDeployItem.newModuleBytes(
      contractWasm,
      runtimeArgs
    );

    const payment = DeployUtil.standardPayment(PAYMENT_AMOUNT);

    const deploy = DeployUtil.makeDeploy(deployParams, session, payment);

    // Sign the deploy
    console.log('Signing deploy...');
    const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

    // Submit to network
    console.log('Submitting deploy to network...');
    const client = new CasperServiceByJsonRPC(CASPER_NODE_URL);
    
    // Convert deploy to JSON and submit
    const deployJson = DeployUtil.deployToJson(signedDeploy);
    const deployResult = await client.deploy(deployJson.deploy as any);
    const deployHash = deployResult.deploy_hash;

    console.log('\n========================================');
    console.log('Deploy Submitted Successfully!');
    console.log('========================================');
    console.log(`Deploy Hash: ${deployHash}`);
    console.log(`\nView on explorer: https://testnet.cspr.live/deploy/${deployHash}`);

    // Wait for deployment confirmation
    console.log('\nWaiting for deploy to be processed (this may take a few minutes)...');
    
    const result = await waitForDeploy(client, deployHash, 300000); // 5 minute timeout
    
    if (result.success) {
      console.log('\n========================================');
      console.log('Deployment Confirmed!');
      console.log('========================================');
      console.log(`Block Hash: ${result.blockHash}`);
      console.log(`Execution Cost: ${result.cost} motes`);
      
      // Get the contract hash from the execution results
      if (result.contractHash) {
        console.log(`\nContract Hash: ${result.contractHash}`);
        console.log('\nUpdate your .env files with:');
        console.log(`  WORKFLOW_CONTRACT_HASH=${result.contractHash}`);
        console.log(`  VITE_WORKFLOW_CONTRACT_HASH=${result.contractHash}`);
      }
    } else {
      console.error('\n========================================');
      console.error('Deployment Failed!');
      console.error('========================================');
      console.error(`Error: ${result.errorMessage}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('\nDeployment failed:', error);
    process.exit(1);
  }
}

interface DeployResult {
  success: boolean;
  blockHash?: string;
  cost?: string;
  contractHash?: string;
  errorMessage?: string;
}

async function waitForDeploy(
  client: typeof CasperServiceByJsonRPC.prototype,
  deployHash: string,
  timeoutMs: number
): Promise<DeployResult> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const deployInfo = await client.getDeployInfo(deployHash);
      const executionResults = (deployInfo as any).execution_results;

      if (executionResults && executionResults.length > 0) {
        const execution = executionResults[0];
        
        if ('Success' in execution.result) {
          // Try to extract contract hash from transforms
          let contractHash: string | undefined;
          const transforms = execution.result.Success?.effect?.transforms || [];
          
          for (const transform of transforms) {
            if (transform.transform && typeof transform.transform === 'object') {
              const t = transform.transform as Record<string, unknown>;
              if ('WriteContract' in t || 'AddKeys' in t) {
                // Extract contract hash from the key
                const key = transform.key as string;
                if (key && key.startsWith('hash-')) {
                  contractHash = key;
                  break;
                }
              }
            }
          }

          return {
            success: true,
            blockHash: execution.block_hash,
            cost: String(execution.result.Success?.cost || '0'),
            contractHash,
          };
        } else if ('Failure' in execution.result) {
          return {
            success: false,
            blockHash: execution.block_hash,
            errorMessage: execution.result.Failure?.error_message || 'Unknown error',
          };
        }
      }
    } catch (error) {
      // Deploy not yet processed, continue waiting
      console.log('.');
    }
    
    await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
  }
  
  return {
    success: false,
    errorMessage: 'Deployment timed out waiting for confirmation',
  };
}

main().catch(console.error);
