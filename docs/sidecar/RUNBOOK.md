# CEWCE Sidecar Operations Runbook

## Quick Reference

### Service Endpoints

| Service | Port | Purpose |
|---------|------|---------|
| Sidecar RPC | 7777 | JSON-RPC API |
| Sidecar REST | 18888 | Block/Deploy queries |
| Sidecar Admin | 18887 | Metrics/Health |
| Sidecar SSE | 19999 | Event stream |
| Node Binary | 28101 | Sidecar connection |
| Node SSE | 18101 | Node events (to Sidecar) |
| Node REST | 14101 | Node status |

### Health Check Commands

```bash
# Sidecar REST health
curl -s http://localhost:18888/block | jq '.header.height'

# Sidecar admin health
curl -s http://localhost:18887/metrics | grep node_connection

# Node health
curl -s http://localhost:14101/status | jq '.peers'

# Backend health
curl -s http://localhost:3001/health | jq
```

---

## Startup Procedures

### Start Full Stack (Development)

```bash
cd /path/to/cewce

# Start base services (db, redis, backend, frontend)
docker-compose up -d

# Add sidecar stack
docker-compose -f docker-compose.yml -f docker-compose.sidecar.yml up -d

# Verify all services
docker-compose -f docker-compose.yml -f docker-compose.sidecar.yml ps
```

### Start Sidecar Only

```bash
# If node is external (e.g., cspr.cloud)
docker run -d \
  --name casper-sidecar \
  -p 7777:7777 \
  -p 18888:18888 \
  -p 18887:18887 \
  -p 19999:19999 \
  -v ./infrastructure/sidecar/sidecar-config.toml:/etc/casper-sidecar/config.toml:ro \
  makesoftware/casper-sidecar:v2.0.0 \
  --path-to-config /etc/casper-sidecar/config.toml
```

### Production Kubernetes Start

```bash
# Deploy sidecar
kubectl apply -f infrastructure/k8s/sidecar.yaml

# Wait for ready
kubectl rollout status deployment/casper-sidecar

# Enable in backend
kubectl set env deployment/backend \
  CASPER_USE_SIDECAR=true \
  CASPER_SSE_ENABLED=true
```

---

## Shutdown Procedures

### Graceful Shutdown (Development)

```bash
# Stop sidecar stack
docker-compose -f docker-compose.yml -f docker-compose.sidecar.yml down

# Or stop sidecar only
docker stop cewce-casper-sidecar cewce-casper-node
```

### Production Shutdown

```bash
# 1. Disable sidecar in backend first
kubectl set env deployment/backend CASPER_USE_SIDECAR=false

# 2. Wait for connections to drain (30s)
sleep 30

# 3. Scale down sidecar
kubectl scale deployment/casper-sidecar --replicas=0

# 4. Delete if removing permanently
kubectl delete -f infrastructure/k8s/sidecar.yaml
```

---

## Monitoring Commands

### Check Sidecar Status

```bash
# Connection to node
curl -s http://localhost:18887/metrics | grep -E "node_connection|blocks_processed"

# Current block height
curl -s http://localhost:18888/block | jq '.header.height'

# SSE subscribers
curl -s http://localhost:18887/metrics | grep sse_subscriber
```

### Check Backend Metrics

```bash
# Casper client metrics (if endpoint exists)
curl -s http://localhost:3001/metrics | grep -E "cewce_sidecar|cewce_node|cewce_fallback"

# Or via logs
docker logs cewce-backend 2>&1 | grep -E "Sidecar|fallback|SSE"
```

### Check Fallback Events

```bash
# Recent fallbacks in logs
docker logs cewce-backend 2>&1 | grep "falling back to node"

# Count fallbacks in last hour
docker logs --since 1h cewce-backend 2>&1 | grep -c "fallback"
```

---

## Troubleshooting Procedures

### Issue: Sidecar Cannot Connect to Node

**Symptoms**: 
- Sidecar logs show connection errors
- `/block` endpoint returns 500

**Steps**:
```bash
# 1. Check node is running
docker ps | grep casper-node
curl http://localhost:14101/status

# 2. Check network connectivity
docker exec cewce-casper-sidecar ping casper-node

# 3. Verify port bindings
docker exec cewce-casper-sidecar nc -zv casper-node 28101
docker exec cewce-casper-sidecar nc -zv casper-node 18101

# 4. Check sidecar config
docker exec cewce-casper-sidecar cat /etc/casper-sidecar/config.toml | grep ip_address

# 5. Restart sidecar
docker restart cewce-casper-sidecar
```

### Issue: High Fallback Rate

**Symptoms**:
- Metrics show `cewce_fallback_count_total` increasing
- Logs show frequent "falling back to node"

**Steps**:
```bash
# 1. Check sidecar response time
time curl -s http://localhost:18888/block > /dev/null

# 2. If slow, check sidecar resources
docker stats cewce-casper-sidecar

# 3. Check for errors
docker logs --tail 100 cewce-casper-sidecar | grep -i error

# 4. Consider increasing timeout
# In config.ts: timeout: 5000 (5s instead of 2s)

# 5. If persistent, disable sidecar temporarily
# Set CASPER_USE_SIDECAR=false
```

### Issue: SSE Events Not Processing

**Symptoms**:
- Workflow state updates delayed
- SSE connection status shows disconnected

**Steps**:
```bash
# 1. Test SSE endpoint manually
curl -N http://localhost:19999/events &
# Should see heartbeat events

# 2. Check backend SSE listener
docker logs cewce-backend 2>&1 | grep SSE

# 3. Check for reconnect loops
docker logs cewce-backend 2>&1 | grep -c "Scheduling SSE reconnect"

# 4. Force reconnect (if admin endpoint exists)
curl -X POST http://localhost:3001/admin/sse/reconnect

# 5. If persistent, disable SSE
# Set CASPER_SSE_ENABLED=false
# Polling fallback will activate
```

### Issue: Sidecar Database Growing Large

**Symptoms**:
- Disk usage increasing
- Sidecar performance degrading

**Steps**:
```bash
# 1. Check database size
docker exec cewce-casper-sidecar du -sh /data/sidecar/

# 2. Sidecar uses SQLite - check WAL files
docker exec cewce-casper-sidecar ls -la /data/sidecar/*.db*

# 3. If too large, can prune old events (restart required)
# Note: This loses historical events
docker stop cewce-casper-sidecar
docker volume rm cewce_sidecar_data
docker start cewce-casper-sidecar
```

---

## Maintenance Procedures

### Update Sidecar Version

```bash
# 1. Check current version
docker exec cewce-casper-sidecar /usr/bin/casper-sidecar --version

# 2. Pull new version
docker pull makesoftware/casper-sidecar:vX.Y.Z

# 3. Update docker-compose.sidecar.yml
#    image: makesoftware/casper-sidecar:vX.Y.Z

# 4. Rolling update
docker-compose -f docker-compose.yml -f docker-compose.sidecar.yml up -d casper-sidecar

# 5. Verify health
curl http://localhost:18888/block
```

### Rotate Logs

```bash
# Sidecar logs are handled by Docker
docker logs --tail 0 -f cewce-casper-sidecar

# To limit log size, add to docker-compose:
#   logging:
#     driver: json-file
#     options:
#       max-size: "100m"
#       max-file: "3"
```

### Backup Sidecar Data

```bash
# Stop sidecar first for consistent backup
docker stop cewce-casper-sidecar

# Backup volume
docker run --rm -v cewce_sidecar_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/sidecar-backup-$(date +%Y%m%d).tar.gz /data

# Restart
docker start cewce-casper-sidecar
```

---

## Emergency Procedures

### Complete Sidecar Disable (Emergency)

```bash
# 1. Immediately disable in backend
export CASPER_USE_SIDECAR=false
export CASPER_SSE_ENABLED=false

# 2. Restart backend (or set env in running container)
docker restart cewce-backend
# OR for k8s:
kubectl set env deployment/backend CASPER_USE_SIDECAR=false CASPER_SSE_ENABLED=false

# 3. Verify using node RPC
docker logs cewce-backend 2>&1 | tail -5
# Should show: "Running in RPC-only mode"

# 4. Stop sidecar if needed
docker stop cewce-casper-sidecar cewce-casper-node
```

### Node RPC Fallback Verification

```bash
# Verify backend can reach node directly
docker exec cewce-backend curl -s https://rpc.testnet.casperlabs.io/rpc \
  -H "Content-Type: application/json" \
  -d '{"id":1,"jsonrpc":"2.0","method":"info_get_status","params":[]}' | jq

# Test workflow creation still works
curl -X POST http://localhost:3001/api/workflow-instances \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"templateId":"...","title":"Test"}'
```

---

## Contact / Escalation

For critical issues:
1. Check this runbook first
2. Review logs with commands above
3. If sidecar-related, can always disable and fallback to node RPC
4. Escalate to DevOps team if node connectivity issues persist
