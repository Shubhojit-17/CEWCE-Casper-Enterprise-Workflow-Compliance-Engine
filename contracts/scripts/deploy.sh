#!/bin/bash
# =============================================================================
# CEWCE Contract Deployment Script
# =============================================================================
# Deploys the workflow contract to Casper Testnet
# =============================================================================

set -e

# Configuration
CASPER_NODE_URL="${CASPER_NODE_URL:-https://testnet.cspr.live/rpc}"
CHAIN_NAME="${CHAIN_NAME:-casper-test}"
CONTRACT_WASM="./target/wasm32-unknown-unknown/release/workflow_contract.wasm"
PAYMENT_AMOUNT="${PAYMENT_AMOUNT:-200000000000}" # 200 CSPR

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}CEWCE Contract Deployment${NC}"
echo -e "${GREEN}========================================${NC}"

# Check for required tools
if ! command -v casper-client &> /dev/null; then
    echo -e "${RED}Error: casper-client is not installed${NC}"
    echo "Install with: cargo install casper-client"
    exit 1
fi

# Check for secret key
if [ -z "$DEPLOYER_SECRET_KEY" ]; then
    echo -e "${RED}Error: DEPLOYER_SECRET_KEY environment variable not set${NC}"
    echo "Set it with: export DEPLOYER_SECRET_KEY=/path/to/secret_key.pem"
    exit 1
fi

if [ ! -f "$DEPLOYER_SECRET_KEY" ]; then
    echo -e "${RED}Error: Secret key file not found: $DEPLOYER_SECRET_KEY${NC}"
    exit 1
fi

# Check for compiled contract
if [ ! -f "$CONTRACT_WASM" ]; then
    echo -e "${YELLOW}Contract not found. Building...${NC}"
    cd contracts
    cargo build --release --target wasm32-unknown-unknown
    cd ..
fi

echo -e "\n${YELLOW}Configuration:${NC}"
echo "  Node URL: $CASPER_NODE_URL"
echo "  Chain Name: $CHAIN_NAME"
echo "  Contract: $CONTRACT_WASM"
echo "  Payment: $PAYMENT_AMOUNT motes"

# Get deployer's public key
DEPLOYER_PUBLIC_KEY=$(casper-client keygen -f | head -1)
echo "  Deployer: $DEPLOYER_PUBLIC_KEY"

echo -e "\n${YELLOW}Deploying contract...${NC}"

# Deploy the contract
DEPLOY_RESULT=$(casper-client put-deploy \
    --node-address "$CASPER_NODE_URL" \
    --chain-name "$CHAIN_NAME" \
    --secret-key "$DEPLOYER_SECRET_KEY" \
    --payment-amount "$PAYMENT_AMOUNT" \
    --session-path "$CONTRACT_WASM" \
    2>&1)

# Extract deploy hash
DEPLOY_HASH=$(echo "$DEPLOY_RESULT" | grep -oP '"deploy_hash":\s*"\K[^"]+')

if [ -z "$DEPLOY_HASH" ]; then
    echo -e "${RED}Error: Failed to get deploy hash${NC}"
    echo "$DEPLOY_RESULT"
    exit 1
fi

echo -e "${GREEN}Deploy submitted!${NC}"
echo "Deploy Hash: $DEPLOY_HASH"
echo -e "\nView on explorer: https://testnet.cspr.live/deploy/$DEPLOY_HASH"

echo -e "\n${YELLOW}Waiting for deploy to be processed...${NC}"

# Wait for deploy to be processed (max 5 minutes)
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    echo -n "."
    
    DEPLOY_INFO=$(casper-client get-deploy \
        --node-address "$CASPER_NODE_URL" \
        "$DEPLOY_HASH" 2>&1)
    
    # Check if execution results exist
    if echo "$DEPLOY_INFO" | grep -q '"execution_results"'; then
        if echo "$DEPLOY_INFO" | grep -q '"Success"'; then
            echo -e "\n${GREEN}Deploy successful!${NC}"
            
            # Get contract hash from account's named keys
            # (This would need the actual account query, simplified here)
            echo -e "\n${YELLOW}To get the contract hash:${NC}"
            echo "1. Go to https://testnet.cspr.live/account/$DEPLOYER_PUBLIC_KEY"
            echo "2. Look for 'workflow_contract' in Named Keys"
            echo "3. Copy the hash and set WORKFLOW_CONTRACT_HASH environment variable"
            
            exit 0
        elif echo "$DEPLOY_INFO" | grep -q '"Failure"'; then
            echo -e "\n${RED}Deploy failed!${NC}"
            echo "$DEPLOY_INFO" | grep -A5 '"Failure"'
            exit 1
        fi
    fi
    
    sleep 10
done

echo -e "\n${YELLOW}Timeout waiting for deploy. Check status manually:${NC}"
echo "casper-client get-deploy --node-address $CASPER_NODE_URL $DEPLOY_HASH"
