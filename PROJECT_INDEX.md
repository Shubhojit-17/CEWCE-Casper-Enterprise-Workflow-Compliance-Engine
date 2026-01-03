# CEWCE Project Structure

## Complete File Index

This document provides a complete index of all files in the CEWCE (Casper Enterprise Workflow & Compliance Engine) project.

### Root Files
- `.env.example` - Environment variables template
- `.eslintrc.json` - ESLint configuration
- `.gitignore` - Git ignore rules
- `.prettierrc` - Prettier formatting configuration
- `docker-compose.yml` - Docker Compose orchestration
- `LICENSE` - MIT License
- `README.md` - Main project documentation
- `README_QUICK.md` - Quick start guide
- `TECHSTACK.md` - Technology stack documentation

### Smart Contracts (`/contracts`)
```
contracts/
├── Cargo.toml                    # Workspace Cargo configuration
├── README.md                     # Contracts documentation
├── scripts/
│   └── deploy.sh                 # Contract deployment script
└── workflow-contract/
    ├── Cargo.toml                # Contract dependencies
    └── src/
        └── main.rs               # Workflow state machine contract
```

### Backend (`/backend`)
```
backend/
├── .env.example                  # Backend environment template
├── Dockerfile                    # Production Docker image
├── jest.config.js                # Jest test configuration
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript configuration
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/
│       └── 0001_initial/
│           └── migration.sql     # Initial database migration
└── src/
    ├── index.ts                  # Application entry point
    ├── server.ts                 # Express server setup
    ├── __tests__/
    │   ├── setup.ts              # Test setup configuration
    │   ├── lib/
    │   │   └── jwt.test.ts       # JWT utility tests
    │   └── routes/
    │       └── health.test.ts    # Health route tests
    ├── jobs/
    │   ├── index.ts              # Job queue exports
    │   ├── deploy-confirmation.ts # Blockchain deploy monitoring
    │   └── sla-monitor.ts        # SLA deadline monitoring
    ├── lib/
    │   ├── casper.ts             # Casper blockchain client
    │   ├── config.ts             # Configuration management
    │   ├── crypto.ts             # Cryptographic utilities
    │   ├── jwt.ts                # JWT token handling
    │   ├── logger.ts             # Winston logger
    │   ├── prisma.ts             # Prisma client instance
    │   └── redis.ts              # Redis client instance
    ├── middleware/
    │   ├── auth.ts               # Authentication middleware
    │   ├── error-handler.ts      # Global error handler
    │   ├── not-found.ts          # 404 handler
    │   └── rate-limiter.ts       # Rate limiting
    └── routes/
        ├── audit.ts              # Audit log endpoints
        ├── auth.ts               # Authentication endpoints
        ├── casper.ts             # Casper blockchain endpoints
        ├── health.ts             # Health check endpoints
        ├── users.ts              # User management endpoints
        ├── workflow-instances.ts # Workflow instance CRUD
        └── workflows.ts          # Workflow template CRUD
```

### Frontend (`/frontend`)
```
frontend/
├── .env.example                  # Frontend environment template
├── Dockerfile                    # Production Docker image
├── index.html                    # HTML entry point
├── nginx.conf                    # Nginx configuration
├── package.json                  # Node.js dependencies
├── postcss.config.js             # PostCSS configuration
├── tailwind.config.js            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript configuration
├── tsconfig.node.json            # Node TypeScript configuration
├── vite.config.ts                # Vite build configuration
├── public/
│   └── favicon.svg               # Application favicon
└── src/
    ├── App.tsx                   # Main React application
    ├── index.css                 # Global styles
    ├── main.tsx                  # React entry point
    ├── components/
    │   └── ui/
    │       └── index.tsx         # Reusable UI components
    ├── hooks/
    │   ├── index.ts              # Hook exports
    │   ├── useCommon.ts          # Common utility hooks
    │   └── useQueries.ts         # TanStack Query hooks
    ├── layouts/
    │   ├── AuthLayout.tsx        # Authentication layout
    │   └── DashboardLayout.tsx   # Dashboard layout with sidebar
    ├── lib/
    │   ├── api.ts                # API client (Axios)
    │   ├── constants.ts          # Application constants
    │   └── utils.ts              # Utility functions
    ├── pages/
    │   ├── audit/
    │   │   └── AuditLogPage.tsx  # Audit log viewer
    │   ├── auth/
    │   │   ├── LoginPage.tsx     # User login
    │   │   └── RegisterPage.tsx  # User registration
    │   ├── dashboard/
    │   │   └── DashboardPage.tsx # Main dashboard
    │   ├── settings/
    │   │   └── SettingsPage.tsx  # User settings
    │   ├── templates/
    │   │   └── TemplatesPage.tsx # Template management
    │   ├── wallet/
    │   │   └── WalletPage.tsx    # Casper wallet integration
    │   └── workflows/
    │       ├── CreateWorkflowPage.tsx  # Create new workflow
    │       ├── WorkflowDetailPage.tsx  # Workflow details
    │       └── WorkflowsPage.tsx       # Workflow list
    ├── services/
    │   ├── index.ts              # Service exports
    │   └── casperWallet.ts       # Casper wallet service
    ├── stores/
    │   ├── auth.ts               # Authentication state
    │   └── wallet.ts             # Wallet state
    └── types/
        └── index.ts              # TypeScript type definitions
```

### Infrastructure (`/infrastructure`)
```
infrastructure/
├── k8s/
│   ├── backend.yaml              # Backend Kubernetes manifests
│   ├── frontend.yaml             # Frontend Kubernetes manifests
│   └── ingress.yaml              # Ingress configuration
└── nginx/
    └── nginx.conf                # Production Nginx reverse proxy
```

### Documentation (`/docs`)
```
docs/
├── README.md                     # Documentation index
├── api/
│   └── README.md                 # API documentation
├── architecture/
│   └── README.md                 # Architecture documentation
└── contracts/
    └── README.md                 # Smart contract documentation
```

### CI/CD (`/.github`)
```
.github/
└── workflows/
    └── ci.yml                    # GitHub Actions CI/CD pipeline
```

### Scripts (`/scripts`)
```
scripts/
└── setup.sh                      # Development environment setup
```

## Quick Start Commands

### Development Setup
```bash
# Clone repository
git clone https://github.com/your-org/cewce.git
cd cewce

# Run setup
chmod +x scripts/setup.sh
./scripts/setup.sh

# Start infrastructure
docker compose up -d postgres redis

# Start backend
cd backend && npm install && npm run dev

# Start frontend (new terminal)
cd frontend && npm install && npm run dev
```

### Production Deployment
```bash
# Build and start all services
docker compose up -d

# Or with Kubernetes
kubectl apply -f infrastructure/k8s/
```

### Smart Contract Deployment
```bash
cd contracts
cargo build --release --target wasm32-unknown-unknown
./scripts/deploy.sh
```

## Total Files: 96

### By Category:
- Root Configuration: 9 files
- Smart Contracts: 5 files
- Backend: 32 files
- Frontend: 35 files
- Infrastructure: 4 files
- Documentation: 4 files
- CI/CD: 1 file
- Scripts: 1 file

## Technology Summary

| Layer | Technologies |
|-------|--------------|
| Blockchain | Casper Network (Testnet), Rust Smart Contracts |
| Backend | Node.js 18, Express.js, TypeScript, Prisma, PostgreSQL, Redis, BullMQ |
| Frontend | React 18, Vite 5, TypeScript, TailwindCSS, TanStack Query, Zustand |
| Infrastructure | Docker, Kubernetes, Nginx, GitHub Actions |

---
Generated: 2024
Version: 1.0.0
