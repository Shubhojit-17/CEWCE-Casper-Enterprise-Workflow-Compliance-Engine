# CEWCE Demo Script

## For Hackathon Judges: 5-Minute Walkthrough

This script guides you through demonstrating CEWCE's enterprise workflow capabilities on the Casper blockchain.

---

## 🎬 Setup (30 seconds)

### Prerequisites Check
```bash
# Ensure services are running
docker-compose up -d

# Verify health
curl http://localhost:3001/api/v1/health
```

Expected response:
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "casper": {
    "sidecar": "connected",
    "node": "connected"
  }
}
```

---

## 📋 Demo Flow

### Scene 1: Authentication (30 seconds)

**Narrative**: "CEWCE supports both traditional login and Casper wallet authentication."

1. Open http://localhost:3000
2. Click **"Connect Wallet"**
3. Sign the authentication message with Casper Wallet
4. Show: User is now authenticated with their public key

**Key Point**: "No password stored - authentication is cryptographic!"

---

### Scene 2: Create Workflow Template (1 minute)

**Narrative**: "Let's create an Invoice Approval workflow with 3 states."

1. Navigate to **Workflows → Create Template**
2. Enter:
   - Name: "Invoice Approval"
   - Description: "Three-stage approval for invoices over $10,000"
3. Add States:
   - State 0: "Submitted"
   - State 1: "Manager Approved"
   - State 2: "Finance Approved"
4. Add Transitions:
   - Submitted → Manager Approved (role: MANAGER)
   - Manager Approved → Finance Approved (role: FINANCE)
5. Click **Create**

**Key Point**: "This template is stored in the database AND recorded on the Casper blockchain."

---

### Scene 3: Start Workflow Instance (1 minute)

**Narrative**: "Now let's create an actual invoice for approval."

1. Navigate to **Instances → New Instance**
2. Select: "Invoice Approval" template
3. Enter:
   - Title: "Q4 Server Purchase"
   - Description: "AWS Reserved Instances - $45,000"
4. Click **Submit**

**Key Point**: "Watch the status - it shows 'PENDING' then 'CONFIRMED' when blockchain confirms."

5. **Show the deploy hash**: Click on the instance to see blockchain details

---

### Scene 4: Real-Time Audit Trail (1 minute)

**Narrative**: "This is our killer feature - real-time cryptographic audit trail."

1. Open **Audit → Stream** (or open browser DevTools → Network → EventStream)
2. In another tab, approve the workflow:
   - Navigate to the instance
   - Click **Approve**
   - Add comment: "Approved by Manager"
3. **Watch the audit stream update INSTANTLY**

**Key Point**: "See that? The audit updated in real-time via Sidecar SSE - no polling!"

---

### Scene 5: Cryptographic Verification (1 minute)

**Narrative**: "Every transition has cryptographic proof of blockchain inclusion."

1. Navigate to **Audit → Instance History**
2. Find the approval transition
3. Click **Verify Proof**
4. Show the proof details:
   ```json
   {
     "verified": true,
     "proof": {
       "eventHash": "abc123...",
       "deployHash": "0x...",
       "blockHash": "0x...",
       "blockHeight": 12345,
       "stateRootHash": "0x...",
       "sidecarVerified": true
     },
     "explorerUrl": "https://testnet.cspr.live/deploy/..."
   }
   ```

**Key Point**: "This is enterprise-grade auditability - cryptographic proof that this transition happened at exactly this block."

---

### Scene 6: Resilience Demo (30 seconds)

**Narrative**: "Watch what happens when Sidecar goes down."

1. Stop Sidecar: `docker stop casper-sidecar`
2. Try to approve another transition
3. **Show: System falls back to Node RPC automatically**
4. Start Sidecar: `docker start casper-sidecar`
5. **Show: SSE reconnects automatically**

**Key Point**: "Zero downtime, automatic failover!"

---

## 🎯 Key Talking Points

### For Technical Judges

1. **Dual-Adapter Architecture**
   - Sidecar (primary, 2s timeout) + Node (fallback, 10s timeout)
   - Automatic failover with logging

2. **SSE Event Processing**
   - Real-time blockchain events
   - Idempotent processing with deduplication
   - Exponential backoff reconnection

3. **Cryptographic Proofs**
   - Every transition includes block hash, state root, deploy hash
   - Verifiable on-chain with Sidecar or Node

4. **Casper 2.0 Ready**
   - Handles both DeployProcessed and TransactionProcessed events
   - Pinned to stable versions (node 2.0.4, sidecar 2.0.0)

### For Business Judges

1. **Compliance Ready**
   - Complete audit trail exportable as CSV
   - Cryptographic proof of every action
   - Role-based access control

2. **Real-Time Visibility**
   - Instant updates when approvals happen
   - No waiting for confirmations

3. **Enterprise Resilience**
   - Automatic failover between services
   - No single point of failure

---

## 📊 Metrics to Show

If time permits, show these endpoints:

```bash
# Health check with Sidecar status
curl http://localhost:3001/api/v1/health

# Real-time audit metrics
curl http://localhost:3001/api/v1/audit/stream/status

# Casper client metrics
curl http://localhost:3001/api/v1/casper/metrics
```

---

## 🔗 Quick Links for Judges

| Resource | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| API Docs | http://localhost:3001/api/v1/docs |
| Health Check | http://localhost:3001/api/v1/health |
| Audit Stream | http://localhost:3001/api/v1/audit/stream |
| Testnet Explorer | https://testnet.cspr.live |

---

## 🚨 Troubleshooting

**If something doesn't work:**

1. **Check containers**: `docker-compose ps`
2. **Check logs**: `docker-compose logs -f backend`
3. **Restart services**: `docker-compose restart`

**Common issues:**

| Issue | Solution |
|-------|----------|
| "Wallet not connected" | Install Casper Wallet extension |
| "Deploy failed" | Check testnet faucet for CSPR |
| "SSE not connecting" | Sidecar may be starting, wait 30s |

---

## 🏆 Closing Statement

> "CEWCE demonstrates deep integration with the Casper blockchain, combining enterprise workflow management with cryptographic verifiability. Our Sidecar integration provides real-time events, automatic failover, and production-grade resilience. Every transition is cryptographically provable, making CEWCE suitable for compliance-heavy industries like finance, healthcare, and government."

---

*Demo time: ~5 minutes*
