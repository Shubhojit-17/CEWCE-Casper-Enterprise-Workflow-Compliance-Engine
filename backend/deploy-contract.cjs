/**
 * CEWCE Contract Deployment Script
 * 
 * Deploys the workflow contract to Casper Testnet using casper-js-sdk.
 * This script bypasses the need for casper-client CLI on Windows.
 * 
 * Usage: npx ts-node deploy-contract.cjs
 *    or: node deploy-contract.cjs
 */

const {
  CasperServiceByJsonRPC,
  DeployUtil,
  Keys,
  RuntimeArgs,
  CLPublicKey,
} = require('casper-js-sdk');

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Casper Testnet RPC endpoint - try multiple endpoints for reliability
  nodeUrl: process.env.CASPER_NODE_URL || 'https://testnet.casper.network/rpc',
  
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format motes to CSPR for display
 */
function motesToCspr(motes) {
  return (BigInt(motes) / BigInt(1_000_000_000)).toString();
}

/**
 * Load keypair from PEM file
 * Supports both Ed25519 and Secp256K1 keys
 */
function loadKeyPair(secretKeyPath) {
  const pemContent = fs.readFileSync(secretKeyPath, 'utf8');
  
  // Check key type from PEM header
  if (pemContent.includes('EC PRIVATE KEY') || pemContent.includes('secp256k1')) {
    return Keys.Secp256K1.loadKeyPairFromPrivateFile(secretKeyPath);
  } else {
    return Keys.Ed25519.loadKeyPairFromPrivateFile(secretKeyPath);
  }
}

/**
 * Wait for deploy to be processed and return result
 */
async function waitForDeploy(client, deployHash, timeoutMs, pollInterval) {
  const startTime = Date.now();
  let lastError = null;
  
  console.log('\nPolling for deploy status...');
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const deployInfo = await client.getDeployInfo(deployHash);
      const executionResults = deployInfo.execution_results;
      
      if (executionResults && executionResults.length > 0) {
        const execution = executionResults[0];
        
        if (execution.result.Success) {
          // Extract contract hash from named keys or transforms
          let contractHash = null;
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
            blockHash: execution.block_hash,
            cost: execution.result.Success.cost,
            contractHash,
            transforms,
          };
        } else if (execution.result.Failure) {
          return {
            success: false,
            blockHash: execution.block_hash,
            errorMessage: execution.result.Failure.error_message,
            cost: execution.result.Failure.cost,
          };
        }
      }
    } catch (error) {
      lastError = error;
      // Deploy not found yet, continue polling
    }
    
    process.stdout.write('.');
    await sleep(pollInterval);
  }
  
  return {
    success: false,
    errorMessage: `Timeout waiting for deploy. Last error: ${lastError?.message || 'None'}`,
  };
}

// ============================================================================
// Main Deployment Function
// ============================================================================

async function deploy() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║           CEWCE Contract Deployment Script                     ║');
  console.log('║           Casper Network - Windows Compatible                  ║');
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
  console.log(`✅ Contract WASM found: ${CONFIG.wasmPath}`);
  
  // Check secret key
  if (!fs.existsSync(CONFIG.secretKeyPath)) {
    console.error('❌ ERROR: Secret key not found!');
    console.error(`   Expected path: ${CONFIG.secretKeyPath}`);
    console.error('\n   Please provide a valid Casper secret key file.\n');
    process.exit(1);
  }
  console.log(`✅ Secret key found: ${CONFIG.secretKeyPath}`);
  
  // -------------------------------------------------------------------------
  // Step 2: Load Keys and WASM
  // -------------------------------------------------------------------------
  console.log('\nStep 2: Loading keys and contract...\n');
  
  // Load keypair
  let keyPair;
  try {
    keyPair = loadKeyPair(CONFIG.secretKeyPath);
    console.log(`✅ Keypair loaded successfully`);
    console.log(`   Public Key: ${keyPair.publicKey.toHex()}`);
    console.log(`   Account Hash: ${keyPair.publicKey.toAccountHashStr()}`);
  } catch (error) {
    console.error('❌ ERROR: Failed to load keypair:', error.message);
    process.exit(1);
  }
  
  // Load WASM
  const wasmBuffer = fs.readFileSync(CONFIG.wasmPath);
  const wasmSize = wasmBuffer.length;
  console.log(`✅ Contract WASM loaded: ${wasmSize} bytes (${(wasmSize / 1024).toFixed(2)} KB)`);
  
  // -------------------------------------------------------------------------
  // Step 3: Build the Deploy
  // -------------------------------------------------------------------------
  console.log('\nStep 3: Building deploy...\n');
  
  console.log('Configuration:');
  console.log(`   Node URL: ${CONFIG.nodeUrl}`);
  console.log(`   Chain: ${CONFIG.chainName}`);
  console.log(`   Payment: ${CONFIG.paymentAmount} motes (${motesToCspr(CONFIG.paymentAmount)} CSPR)`);
  
  // Create deploy parameters
  const deployParams = new DeployUtil.DeployParams(
    keyPair.publicKey,
    CONFIG.chainName,
    1,       // gasPrice
    1800000  // ttl (30 minutes in ms)
  );
  
  // Create session (module bytes with the WASM)
  const session = DeployUtil.ExecutableDeployItem.newModuleBytes(
    wasmBuffer,
    RuntimeArgs.fromMap({})  // No constructor arguments
  );
  
  // Create payment
  const payment = DeployUtil.standardPayment(CONFIG.paymentAmount);
  
  // Build the deploy
  const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
  console.log(`✅ Deploy created with hash: ${Buffer.from(deploy.hash).toString('hex')}`);
  
  // -------------------------------------------------------------------------
  // Step 4: Sign the Deploy
  // -------------------------------------------------------------------------
  console.log('\nStep 4: Signing deploy...\n');
  
  const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);
  console.log(`✅ Deploy signed by: ${keyPair.publicKey.toHex()}`);
  
  // -------------------------------------------------------------------------
  // Step 5: Submit to Network
  // -------------------------------------------------------------------------
  console.log('\nStep 5: Submitting deploy to network...\n');
  
  const client = new CasperServiceByJsonRPC(CONFIG.nodeUrl);
  
  let deployHash;
  try {
    // Submit the signed deploy directly (SDK handles JSON conversion internally)
    const result = await client.deploy(signedDeploy);
    deployHash = result.deploy_hash;
    
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    DEPLOY SUBMITTED!                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n   Deploy Hash: ${deployHash}`);
    console.log(`   Explorer: https://testnet.cspr.live/deploy/${deployHash}\n`);
  } catch (error) {
    console.error('❌ ERROR: Failed to submit deploy:', error.message);
    if (error.data) {
      console.error('   Details:', JSON.stringify(error.data, null, 2));
    }
    process.exit(1);
  }
  
  // -------------------------------------------------------------------------
  // Step 6: Wait for Confirmation
  // -------------------------------------------------------------------------
  console.log('Step 6: Waiting for deploy confirmation...');
  console.log(`   (Timeout: ${CONFIG.deployTimeout / 1000} seconds)\n`);
  
  const result = await waitForDeploy(
    client,
    deployHash,
    CONFIG.deployTimeout,
    CONFIG.pollInterval
  );
  
  console.log('\n');
  
  if (result.success) {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║                  DEPLOYMENT SUCCESSFUL!                        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n   Block Hash: ${result.blockHash}`);
    console.log(`   Execution Cost: ${result.cost} motes (${motesToCspr(result.cost)} CSPR)`);
    
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
    
    return { success: true, deployHash, contractHash: result.contractHash };
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
