# CEWCE Architecture Overview

## For Hackathon Judges: 3-Minute Executive Summary

CEWCE (Casper Enterprise Workflow Contract Engine) is a **production-grade, cryptographically verifiable workflow engine** built on the Casper blockchain. This document explains the technical architecture that makes it enterprise-ready.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (React)                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────────────┐ │
│  │  Dashboard  │  │  Workflows  │  │   Audit     │  │  Real-Time Stream  │ │
│  │   (React)   │  │  (CRUD)     │  │   (Export)  │  │  (SSE + Polling)   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS/WSS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (Express + TypeScript)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │  REST API    │  │   Auth       │  │  Background  │  │  SSE Listener   │ │
│  │  Routes      │  │   JWT/Wallet │  │  Jobs (BullMQ)│  │  (Sidecar)      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                      CASPER CLIENT ABSTRACTION                        │  │
│  │  ┌─────────────────────┐              ┌─────────────────────┐        │  │
│  │  │   SidecarAdapter    │─── fail ───▶ │    NodeAdapter      │        │  │
│  │  │   (Primary, 2s)     │              │   (Fallback, 10s)   │        │  │
│  │  └─────────────────────┘              └─────────────────────┘        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
        │                      │                           │
        │ PostgreSQL           │ Redis                     │ Casper Network
        ▼                      ▼                           ▼
┌───────────────┐     ┌───────────────┐     ┌─────────────────────────────────┐
│   Postgres    │     │    Redis      │     │      CASPER BLOCKCHAIN          │
│   (Prisma)    │     │   (BullMQ)    │     │  ┌──────────┐  ┌─────────────┐  │
│ ─────────────│     │ ─────────────│     │  │  Node    │  │  Sidecar    │  │
│ • Users       │     │ • Job Queues  │     │  │  v2.0.4  │  │  v2.0.0     │  │
│ • Workflows   │     │ • Rate Limits │     │  │  (RPC)   │  │  (SSE+REST) │  │
│ • Transitions │     │ • Sessions    │     │  └──────────┘  └─────────────┘  │
│ • Audit Logs  │     │               │     │         │              │        │
└───────────────┘     └───────────────┘     │         └──────┬───────┘        │
                                            │                │                │
                                            │  ┌─────────────▼─────────────┐  │
                                            │  │   Workflow Smart Contract  │  │
                                            │  │   (Casper 2.0 / Condor)   │  │
                                            │  └───────────────────────────┘  │
                                            └─────────────────────────────────┘
```

---

## 🔑 Key Innovation: Dual-Adapter Architecture

CEWCE uses a **dual-adapter pattern** that provides:

### 1. SidecarAdapter (Primary)
- **Timeout**: 2 seconds (fast-fail)
- **Endpoints**: REST + JSON-RPC
- **Use Case**: Real-time data, SSE events
- **Advantage**: Lower latency, event streaming

### 2. NodeAdapter (Fallback)
- **Timeout**: 10 seconds (resilient)
- **Endpoints**: Node JSON-RPC only
- **Use Case**: Deploy submission, state queries
- **Advantage**: Direct access, always available

```typescript
// Example: Automatic failover
async getDeploy(hash: string) {
  try {
    return await this.sidecarAdapter.getDeploy(hash); // Try Sidecar first
  } catch (error) {
    logger.warn('Sidecar failed, falling back to node');
    return await this.nodeAdapter.getDeploy(hash);   // Automatic fallback
  }
}
```

---

## 📊 Data Flow: Workflow Transition

```
User Action                     Backend                        Blockchain
───────────────────────────────────────────────────────────────────────────

1. "Approve Invoice"  ───▶  Validate permissions
                            Create transition record
                            (status: PENDING)
                                    │
2.                                  ▼
                            Build Casper Deploy
                            Sign with deployer key
                                    │
3.                                  ▼
                            casperClient.sendDeploy()
                            (tries Sidecar, then Node)
                                    │
                                    ├──────────────────────▶  Execute Contract
                                    │                         record_transition()
4.                                  │
                            Return deployHash
                            (status: SUBMITTED)
                                    │
5.  ◀───────────────────────────────┤

   [Background Process]
                                    │
6.  SSE Listener    ◀───────────────┤───────────────────────  DeployProcessed
                                    │                         Event
                            Parse event
                            Match to transition
                            (status: CONFIRMED)
                                    │
7.                                  ▼
                            Generate CryptographicProof
                            Update database
                            Emit real-time audit event
                                    │
8.  Real-Time UI    ◀───────────────┤
    Update                          
```

---

## 🔐 Security Architecture

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Wallet  │────▶│  Sign    │────▶│  Verify  │────▶│  JWT     │
│  Connect │     │  Message │     │  Sig     │     │  Issue   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                        │
                                        ▼
                              ┌──────────────────┐
                              │  bcrypt(sig) ==  │
                              │  stored_hash     │
                              └──────────────────┘
```

### Authorization Model

| Role | Permissions |
|------|-------------|
| USER | Create workflows, view own instances |
| APPROVER | Approve/reject assigned instances |
| ADMIN | All permissions, manage users |
| AUDITOR | View audit logs, export data |

---

## 🔗 Smart Contract Integration

### Contract: `workflow-contract` (Rust/Wasm)

**Key Entry Points:**
- `create_workflow(name, states, transitions, roles)`
- `assign_role(workflow_id, user, role)`
- `record_transition(workflow_id, from_state, to_state, actor)`
- `query_workflow(workflow_id)` → returns full state

**Storage Pattern:**
```rust
// Named keys pattern
"workflow_{id}" → WorkflowData {
    current_state: u64,
    transitions: Vec<TransitionRecord>,
    roles: Map<AccountHash, Role>
}
```

---

## 📈 Observability

### Metrics Collected
- Sidecar latency (p50, p95, p99)
- Fallback frequency
- SSE reconnection count
- Event processing lag
- Active connections

### Logging
- Structured JSON logs (pino)
- Request tracing
- Error aggregation

---

## 🚀 Production Readiness

| Feature | Status |
|---------|--------|
| Auto-reconnecting SSE | ✅ Implemented |
| Exponential backoff | ✅ Implemented |
| Idempotent event processing | ✅ Implemented |
| Cryptographic proofs | ✅ Implemented |
| Real-time audit streaming | ✅ Implemented |
| Fallback on failure | ✅ Implemented |
| Rate limiting | ✅ Implemented |
| Health checks | ✅ Implemented |

---

## 🎯 Why This Architecture?

1. **Resilience**: Dual-adapter ensures availability even when Sidecar is down
2. **Speed**: 2-second Sidecar timeout means fast UX for common operations
3. **Verifiability**: Every transition has cryptographic proof of blockchain inclusion
4. **Real-Time**: SSE provides instant updates without polling
5. **Auditability**: Complete trail from user action to blockchain confirmation

---

*This architecture represents enterprise-grade integration with the Casper blockchain.*
