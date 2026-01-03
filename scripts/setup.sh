#!/bin/bash
# =============================================================================
# CEWCE Development Setup Script
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}CEWCE Development Setup${NC}"
echo -e "${GREEN}========================================${NC}"

# Check for required tools
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "  ${GREEN}✓${NC} $1 found"
        return 0
    else
        echo -e "  ${RED}✗${NC} $1 not found"
        return 1
    fi
}

MISSING_DEPS=0

check_command "node" || MISSING_DEPS=1
check_command "npm" || MISSING_DEPS=1
check_command "docker" || MISSING_DEPS=1
check_command "docker-compose" || echo "  ${YELLOW}!${NC} docker-compose not found (optional for compose v2)"

if [ $MISSING_DEPS -eq 1 ]; then
    echo -e "\n${RED}Please install missing dependencies and try again.${NC}"
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Node.js 18+ required. Current: $(node -v)${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Setting up environment files...${NC}"

# Backend .env
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo -e "  ${GREEN}✓${NC} Created backend/.env"
else
    echo -e "  ${YELLOW}!${NC} backend/.env already exists"
fi

# Frontend .env
if [ ! -f "frontend/.env" ]; then
    cp frontend/.env.example frontend/.env
    echo -e "  ${GREEN}✓${NC} Created frontend/.env"
else
    echo -e "  ${YELLOW}!${NC} frontend/.env already exists"
fi

echo -e "\n${YELLOW}Starting infrastructure services...${NC}"
docker compose up -d postgres redis
sleep 5

echo -e "\n${YELLOW}Installing backend dependencies...${NC}"
cd backend
npm install
echo -e "  ${GREEN}✓${NC} Backend dependencies installed"

echo -e "\n${YELLOW}Running database migrations...${NC}"
npx prisma generate
npx prisma migrate dev --name init
echo -e "  ${GREEN}✓${NC} Database migrations complete"

cd ..

echo -e "\n${YELLOW}Installing frontend dependencies...${NC}"
cd frontend
npm install
echo -e "  ${GREEN}✓${NC} Frontend dependencies installed"
cd ..

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nTo start development:"
echo -e "  1. Backend:  ${YELLOW}cd backend && npm run dev${NC}"
echo -e "  2. Frontend: ${YELLOW}cd frontend && npm run dev${NC}"
echo -e "\nOr use Docker Compose:"
echo -e "  ${YELLOW}docker compose up${NC}"
echo -e "\nAccess the application:"
echo -e "  Frontend: http://localhost:3000"
echo -e "  Backend:  http://localhost:4000/api"
echo -e "\nTo build smart contracts:"
echo -e "  ${YELLOW}cd contracts && cargo build --release --target wasm32-unknown-unknown${NC}"
