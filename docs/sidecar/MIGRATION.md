# CEWCE Sidecar Migration Guide

## Overview

This document describes the migration from RPC-only mode to Sidecar-backed RPC for CEWCE. The migration is designed to be non-disruptive with automatic fallback to direct node RPC.

## Pinned Versions

| Component | Version | Rationale |
|-----------|---------|-----------|
| casper-node | `v2.0.4` | Latest stable Casper 2.0 (Condor) release |
| casper-sidecar | `v2.0.0` | Compatible with casper-node 2.0.3+, provides REST/SSE APIs |

**Source**: [casper-sidecar releases](https://github.com/casper-network/casper-sidecar/releases) and [casper-node releases](https://github.com/casper-network/casper-node/releases)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CEWCE Backend                                │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    casperClient                              │    │
│  │  ┌─────────────────┐         ┌─────────────────┐            │    │
│  │  │  SidecarAdapter │ ──────► │   NodeAdapter   │            │    │
│  │  │   (Primary)     │ fallback│   (Fallback)    │            │    │
│  │  └────────┬────────┘         └────────┬────────┘            │    │
│  └───────────┼───────────────────────────┼─────────────────────┘    │
│              │                           │                           │
│  ┌───────────▼───────────┐   ┌───────────▼───────────┐              │
│  │  SSE Listener         │   │  Direct RPC           │              │
│  │  (Real-time events)   │   │  (Polling fallback)   │              │
│  └───────────┬───────────┘   └───────────┬───────────┘              │
└──────────────┼───────────────────────────┼──────────────────────────┘
               │                           │
     ┌─────────▼─────────┐       ┌─────────▼─────────┐
     │  Casper Sidecar   │       │   Casper Node     │
     │  (v2.0.0)         │◄──────│   (v2.0.4)        │
     │  - REST API       │  SSE  │   - Binary Port   │
     │  - JSON-RPC       │       │   - RPC Port      │
     │  - SSE Events     │       │                   │
     └───────────────────┘       └───────────────────┘
```

## Quick Start (Local Development)

### 1. Start the Sidecar Stack

```bash
# Start all services including node + sidecar
docker-compose -f docker-compose.yml -f docker-compose.sidecar.yml up -d
```

### 2. Enable Sidecar in Environment

Edit `.env`:
```bash
# Enable Sidecar (URLs are set by docker-compose override)
CASPER_USE_SIDECAR=true
CASPER_SSE_ENABLED=true

# When running outside docker, set URLs manually:
CASPER_SIDECAR_URL=http://localhost:7777/rpc
CASPER_SIDECAR_REST_URL=http://localhost:18888
CASPER_SIDECAR_SSE_URL=http://localhost:19999/events
CASPER_SIDECAR_ADMIN_URL=http://localhost:18887
```

### 3. Verify Sidecar Health

```bash
# Check Sidecar REST API
curl http://localhost:18888/block

# Check Sidecar admin metrics
curl http://localhost:18887/metrics

# Check SSE endpoint
curl -N http://localhost:19999/events
```

## Configuration Reference

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `CASPER_NODE_URL` | Direct node RPC URL (fallback) | `https://rpc.testnet.casperlabs.io/rpc` |
| `CASPER_SIDECAR_URL` | Sidecar JSON-RPC URL | - |
| `CASPER_SIDECAR_REST_URL` | Sidecar REST API URL | - |
| `CASPER_SIDECAR_SSE_URL` | Sidecar SSE events URL | - |
| `CASPER_SIDECAR_ADMIN_URL` | Sidecar admin/metrics URL | - |
| `CASPER_USE_SIDECAR` | Enable Sidecar as primary | `false` |
| `CASPER_SSE_ENABLED` | Enable SSE event subscription | `false` |

## Fallback Behavior

The system implements automatic fallback:

1. **Primary (Sidecar)**: All read operations use Sidecar REST/RPC with 2s timeout
2. **Fallback (Node)**: On Sidecar timeout/error, falls back to direct node RPC
3. **Writes**: Deploy submission always uses node RPC for reliability
4. **SSE Fallback**: If SSE disconnects, existing polling jobs continue

Fallback metrics are exposed at `/metrics` for monitoring.

## Monitoring

### Prometheus Metrics

Add to `prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'casper-sidecar'
    static_configs:
      - targets: ['casper-sidecar:18887']
    metrics_path: '/metrics'
```

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `node_connection_status` | Sidecar→Node connection | `== 0` for 1m |
| `cewce_fallback_count_total` | Fallback occurrences | `rate() > 0.1` for 5m |
| `cewce_sse_connection_status` | SSE listener status | `== 0` for 2m |

### Grafana Dashboard

Import `infrastructure/monitoring/grafana-sidecar-dashboard.json` for pre-built visualizations.

## Deployment Checklist

### Pre-Deployment

- [ ] Verify pinned versions match production requirements
- [ ] Review sidecar-config.toml settings
- [ ] Ensure node-config.toml has correct network peers
- [ ] Database backup completed
- [ ] Test fallback behavior in staging

### Deployment Steps

1. **Deploy Sidecar alongside existing node**
   ```bash
   kubectl apply -f infrastructure/k8s/sidecar.yaml
   ```

2. **Wait for Sidecar to sync**
   ```bash
   kubectl logs -f deployment/casper-sidecar
   # Wait for "connected to node" message
   ```

3. **Enable Sidecar in backend (gradual rollout)**
   ```bash
   kubectl set env deployment/backend CASPER_USE_SIDECAR=true
   ```

4. **Enable SSE events**
   ```bash
   kubectl set env deployment/backend CASPER_SSE_ENABLED=true
   ```

5. **Monitor metrics for 15 minutes**
   - Check fallback rate < 5%
   - Check SSE connection stable
   - Verify no increase in error rates

### Post-Deployment

- [ ] Verify workflows can be created
- [ ] Verify state transitions work
- [ ] Check audit logs recording correctly
- [ ] Confirm SSE events processing

## Rollback Procedure

### Quick Rollback (Environment Toggle)

```bash
# Disable Sidecar, revert to RPC-only
kubectl set env deployment/backend CASPER_USE_SIDECAR=false CASPER_SSE_ENABLED=false
```

### Full Rollback (Remove Sidecar)

```bash
# 1. Disable in backend
kubectl set env deployment/backend CASPER_USE_SIDECAR=false CASPER_SSE_ENABLED=false

# 2. Remove Sidecar deployment
kubectl delete -f infrastructure/k8s/sidecar.yaml

# 3. Verify backend using node RPC
kubectl logs deployment/backend | grep "RPC-only mode"
```

### Local Rollback

```bash
# Stop sidecar stack
docker-compose -f docker-compose.yml -f docker-compose.sidecar.yml down

# Start without sidecar
docker-compose up -d

# Update .env
CASPER_USE_SIDECAR=false
CASPER_SSE_ENABLED=false
```

## Troubleshooting

### Sidecar Not Connecting to Node

```bash
# Check Sidecar logs
docker logs cewce-casper-sidecar

# Verify node is healthy
curl http://localhost:14101/status

# Check network connectivity
docker exec cewce-casper-sidecar curl http://casper-node:28101
```

### High Fallback Rate

1. Check Sidecar logs for errors
2. Verify Sidecar has synced with node
3. Check network latency between services
4. Consider increasing timeout from 2s

### SSE Events Not Processing

```bash
# Check SSE connection
curl -N http://localhost:19999/events

# Check backend SSE listener
docker logs cewce-backend | grep SSE

# Force reconnect
curl -X POST http://localhost:3001/admin/sse/reconnect
```

## Resource Requirements

### Sidecar

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 0.5 cores | 2 cores |
| Memory | 512 MB | 2 GB |
| Disk | 10 GB | 50 GB (for event storage) |

### Node (if self-hosted)

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 cores | 8 cores |
| Memory | 16 GB | 32 GB |
| Disk | 500 GB SSD | 1 TB NVMe |

## Migration Phases

### Phase 1: Local Smoke Test ✅
- Docker Compose with node + sidecar
- Verify `/block` endpoint
- Verify admin metrics

### Phase 2: Backend Abstraction ✅
- casperClient with adapters
- Automatic fallback
- Metrics collection

### Phase 3: SSE Pipeline ✅
- Event subscription
- Database persistence
- Reconnection policy

### Phase 4: Staging Deploy
- Health checks configured
- Integration tests passing
- Fallback test verified

### Phase 5: Production Rollout
- Gradual enablement
- Monitoring active
- Runbook ready

## API Compatibility

**No changes to frontend API contracts.** All existing backend HTTP routes remain unchanged. The migration is internal to the Casper client layer.

## Files Modified

| File | Purpose |
|------|---------|
| `backend/src/lib/casperClient/index.ts` | Unified client with fallback |
| `backend/src/lib/casperClient/sidecarAdapter.ts` | Sidecar REST/RPC adapter |
| `backend/src/lib/casperClient/nodeAdapter.ts` | Node RPC adapter |
| `backend/src/lib/casperClient/types.ts` | Shared types |
| `backend/src/services/sidecarListener.ts` | SSE event listener |
| `backend/src/lib/config.ts` | Sidecar config options |
| `docker-compose.sidecar.yml` | Sidecar stack definition |
| `infrastructure/sidecar/sidecar-config.toml` | Sidecar configuration |
| `infrastructure/sidecar/node-config.toml` | Node configuration |
| `infrastructure/monitoring/*` | Prometheus/Grafana configs |
| `.env` | Environment variables |
