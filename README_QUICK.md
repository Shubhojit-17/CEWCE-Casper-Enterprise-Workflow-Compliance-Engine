# CEWCE - Casper Enterprise Workflow & Compliance Engine

A production-grade, decentralized enterprise workflow, compliance, and governance engine built on the Casper blockchain.

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Rust (for smart contracts)

### Development Setup

```bash
# Clone and setup
git clone https://github.com/your-org/cewce.git
cd cewce

# Run setup script
chmod +x scripts/setup.sh
./scripts/setup.sh

# Start services
docker compose up -d postgres redis

# Backend (Terminal 1)
cd backend
npm install
npx prisma migrate dev
npm run dev

# Frontend (Terminal 2)
cd frontend
npm install
npm run dev
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api
- API Health: http://localhost:4000/api/health

### Docker Compose (Full Stack)

```bash
docker compose up
```

## Project Structure

```
cewce/
├── contracts/          # Rust smart contracts
│   └── workflow-contract/
├── backend/            # Node.js/Express API
│   ├── src/
│   │   ├── routes/     # API endpoints
│   │   ├── lib/        # Utilities & services
│   │   ├── middleware/ # Express middleware
│   │   └── jobs/       # Background workers
│   └── prisma/         # Database schema
├── frontend/           # React/TypeScript UI
│   └── src/
│       ├── pages/      # Page components
│       ├── layouts/    # Layout components
│       ├── stores/     # Zustand stores
│       └── lib/        # Utilities
├── infrastructure/     # DevOps configs
│   ├── nginx/          # Nginx configs
│   └── k8s/            # Kubernetes manifests
└── docs/               # Documentation
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Casper Network (Testnet) |
| Smart Contracts | Rust, casper-contract |
| Backend | Node.js 18, Express, TypeScript, Prisma |
| Database | PostgreSQL 14+, Redis 7+ |
| Frontend | React 18, Vite, TypeScript, TailwindCSS |
| Infrastructure | Docker, Kubernetes, Nginx |

## Key Features

- **Blockchain-Verified Workflows**: All state transitions recorded on Casper blockchain
- **Enterprise RBAC**: Role-based access control with multi-sig support
- **SLA Monitoring**: Automated escalation on deadline breaches
- **Audit Trail**: Immutable, cryptographically verifiable audit logs
- **Wallet Integration**: Casper Signer/Wallet support

## Smart Contract

Deploy to Casper Testnet:

```bash
cd contracts
cargo build --release --target wasm32-unknown-unknown

# Set deployer key and deploy
export DEPLOYER_SECRET_KEY=/path/to/secret_key.pem
./scripts/deploy.sh
```

## Configuration

Copy `.env.example` files and configure:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Key environment variables:

```env
# Backend
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-secret
CASPER_NODE_URL=https://testnet.cspr.live/rpc
WORKFLOW_CONTRACT_HASH=hash-xxxxx

# Frontend
VITE_API_URL=/api
VITE_CASPER_NODE_URL=https://testnet.cspr.live/rpc
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |
| POST | /api/auth/login | User login |
| POST | /api/auth/register | User registration |
| GET | /api/workflows | List templates |
| GET | /api/workflow-instances | List instances |
| POST | /api/workflow-instances | Create instance |
| POST | /api/workflow-instances/:id/transition | State transition |
| GET | /api/audit | Audit logs |
| GET | /api/casper/balance/:accountHash | CSPR balance |

## Documentation

- [README.md](docs/README.md) - Full project documentation
- [TECHSTACK.md](TECHSTACK.md) - Technology specifications
- [Architecture](docs/architecture/) - System design
- [API Reference](docs/api/) - API documentation
- [Contracts](docs/contracts/) - Smart contract docs

## Testing

```bash
# Backend tests
cd backend && npm test

# Contract tests
cd contracts && cargo test
```

## Deployment

### Docker

```bash
docker compose -f docker-compose.yml up -d
```

### Kubernetes

```bash
kubectl apply -f infrastructure/k8s/
```

## License

MIT License - see LICENSE file.

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Run tests
5. Submit PR

---

Built on [Casper Network](https://casper.network)
