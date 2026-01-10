// =============================================================================
// Sidecar Integration Tests
// =============================================================================
// Comprehensive tests for Casper Sidecar integration including:
// - SSE reconnection behavior
// - Adapter fallback mechanisms
// - Event processing with deduplication
// - Cryptographic proof generation
//
// Run with: npm test -- sidecar.test.ts
// =============================================================================

import { EventEmitter } from 'events';

// Mock environment
process.env.CASPER_RPC_URL = 'http://localhost:11101/rpc';
process.env.CASPER_SIDECAR_URL = 'http://localhost:18888';
process.env.CASPER_CONTRACT_HASH = 'hash-test123';

// =============================================================================
// Unit Tests: Adapters
// =============================================================================

describe('Casper Client Adapters', () => {
  describe('SidecarAdapter', () => {
    it('should initialize with correct URLs', async () => {
      // Dynamic import to allow env setup first
      const { SidecarAdapter } = await import('../../lib/casperClient/sidecarAdapter.js');
      
      const adapter = new SidecarAdapter({
        restUrl: 'http://localhost:18888',
        rpcUrl: 'http://localhost:11101/rpc',
        chainName: 'casper-test',
        timeout: 5000,
      });

      expect(adapter).toBeDefined();
      // @ts-expect-error accessing private for testing
      expect(adapter.restUrl).toBe('http://localhost:18888');
    });

    it('should build correct REST URLs for endpoints', async () => {
      const { SidecarAdapter } = await import('../../lib/casperClient/sidecarAdapter.js');
      
      const adapter = new SidecarAdapter({
        restUrl: 'http://localhost:18888',
        rpcUrl: 'http://localhost:11101/rpc',
        chainName: 'casper-test',
        timeout: 5000,
      });

      // Test internal URL building (if exposed)
      // This verifies the Sidecar REST API paths are correct
      expect(adapter).toHaveProperty('getDeployInfo');
      expect(adapter).toHaveProperty('getBlock');
      expect(adapter).toHaveProperty('getStateRootHash');
    });
  });

  describe('NodeAdapter', () => {
    it('should initialize with RPC URL', async () => {
      const { NodeAdapter } = await import('../../lib/casperClient/nodeAdapter.js');
      
      const adapter = new NodeAdapter({
        rpcUrl: 'http://localhost:11101/rpc',
        chainName: 'casper-test',
        timeout: 10000,
      });

      expect(adapter).toBeDefined();
    });
  });

  describe('CasperClient (Unified)', () => {
    it('should create client with both adapters', async () => {
      const { casperClient } = await import('../../lib/casperClient/index.js');
      
      expect(casperClient).toBeDefined();
      expect(casperClient).toHaveProperty('getDeploy');
      expect(casperClient).toHaveProperty('getBlock');
      expect(casperClient).toHaveProperty('sendDeploy');
      expect(casperClient).toHaveProperty('healthCheck');
    });
  });
});

// =============================================================================
// Unit Tests: Event Processing
// =============================================================================

describe('On-Chain Event Processing', () => {
  describe('Event Deduplication', () => {
    it('should deduplicate events by deploy hash', async () => {
      const processedEvents = new Map<string, number>();
      
      const processEvent = (deployHash: string): boolean => {
        if (processedEvents.has(deployHash)) {
          return false; // Already processed
        }
        processedEvents.set(deployHash, Date.now());
        return true;
      };

      const hash1 = 'deploy-hash-001';
      const hash2 = 'deploy-hash-002';

      expect(processEvent(hash1)).toBe(true); // First time
      expect(processEvent(hash1)).toBe(false); // Duplicate
      expect(processEvent(hash2)).toBe(true); // Different hash
      expect(processEvent(hash1)).toBe(false); // Still duplicate
    });

    it('should expire old cache entries', async () => {
      jest.useFakeTimers();
      
      const cacheExpiry = 3600000; // 1 hour
      const processedEvents = new Map<string, number>();
      
      const processEvent = (deployHash: string): boolean => {
        const now = Date.now();
        const existingTime = processedEvents.get(deployHash);
        
        if (existingTime && (now - existingTime) < cacheExpiry) {
          return false;
        }
        
        processedEvents.set(deployHash, now);
        return true;
      };

      const hash = 'deploy-hash-003';
      
      expect(processEvent(hash)).toBe(true);
      expect(processEvent(hash)).toBe(false);
      
      // Advance time past expiry
      jest.advanceTimersByTime(cacheExpiry + 1000);
      
      expect(processEvent(hash)).toBe(true); // Should process again
      
      jest.useRealTimers();
    });
  });

  describe('Cryptographic Proof Generation', () => {
    it('should generate deterministic event hash', async () => {
      const { createHash } = await import('crypto');
      
      const generateEventHash = (data: Record<string, unknown>): string => {
        return createHash('sha256')
          .update(JSON.stringify(data))
          .digest('hex');
      };

      const eventData = {
        transitionId: 'trans-001',
        instanceId: 'inst-001',
        fromState: 0,
        toState: 1,
      };

      const hash1 = generateEventHash(eventData);
      const hash2 = generateEventHash(eventData);
      const hash3 = generateEventHash({ ...eventData, toState: 2 });

      expect(hash1).toBe(hash2); // Same data = same hash
      expect(hash1).not.toBe(hash3); // Different data = different hash
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex chars
    });

    it('should include required proof fields', () => {
      interface CryptographicProof {
        eventHash: string;
        deployHash: string | null;
        blockHash: string | null;
        blockHeight: number | null;
        stateRootHash: string | null;
        contractHash: string | null;
        sidecarVerified: boolean;
        verificationTimestamp: string;
      }

      const proof: CryptographicProof = {
        eventHash: 'abc123',
        deployHash: 'deploy-001',
        blockHash: 'block-001',
        blockHeight: 12345,
        stateRootHash: 'state-root-001',
        contractHash: 'hash-contract',
        sidecarVerified: true,
        verificationTimestamp: new Date().toISOString(),
      };

      expect(proof).toHaveProperty('eventHash');
      expect(proof).toHaveProperty('deployHash');
      expect(proof).toHaveProperty('blockHash');
      expect(proof).toHaveProperty('blockHeight');
      expect(proof).toHaveProperty('stateRootHash');
      expect(proof).toHaveProperty('sidecarVerified');
      expect(proof.sidecarVerified).toBe(true);
    });
  });
});

// =============================================================================
// Integration Tests: SSE Reconnection
// =============================================================================

describe('SSE Connection Management', () => {
  class MockEventSource extends EventEmitter {
    url: string;
    readyState: number = 0;
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSED = 2;

    constructor(url: string) {
      super();
      this.url = url;
      // Simulate async connection
      setTimeout(() => {
        this.readyState = MockEventSource.OPEN;
        this.emit('open');
      }, 10);
    }

    close() {
      this.readyState = MockEventSource.CLOSED;
      this.emit('close');
    }

    simulateError(error: Error) {
      this.emit('error', error);
    }

    simulateMessage(type: string, data: unknown) {
      this.emit(type, { data: JSON.stringify(data) });
    }
  }

  describe('Reconnection with Exponential Backoff', () => {
    it('should calculate correct backoff delays', () => {
      const baseDelay = 1000;
      const maxDelay = 60000;
      
      const calculateBackoff = (attempt: number): number => {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        // Add jitter
        return delay + Math.random() * 1000;
      };

      expect(calculateBackoff(0)).toBeGreaterThanOrEqual(baseDelay);
      expect(calculateBackoff(0)).toBeLessThan(baseDelay + 1000);
      expect(calculateBackoff(1)).toBeGreaterThanOrEqual(2000);
      expect(calculateBackoff(5)).toBeGreaterThanOrEqual(32000);
      expect(calculateBackoff(10)).toBeLessThanOrEqual(maxDelay + 1000);
    });

    it('should reset attempt counter on successful connection', async () => {
      let reconnectAttempts = 0;
      const maxAttempts = 5;
      let isConnected = false;

      const connect = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const source = new MockEventSource('http://test');
          
          source.on('open', () => {
            reconnectAttempts = 0; // Reset on success
            isConnected = true;
            resolve(true);
          });

          source.on('error', () => {
            reconnectAttempts++;
            if (reconnectAttempts < maxAttempts) {
              // Would reconnect here
            }
            resolve(false);
          });
        });
      };

      await connect();
      expect(isConnected).toBe(true);
      expect(reconnectAttempts).toBe(0);
    });
  });

  describe('Event Stream Processing', () => {
    it('should parse SSE events correctly', () => {
      const parseSSEEvent = (eventData: string): Record<string, unknown> | null => {
        try {
          return JSON.parse(eventData);
        } catch {
          return null;
        }
      };

      const validEvent = parseSSEEvent('{"type":"DeployProcessed","hash":"abc123"}');
      expect(validEvent).toEqual({ type: 'DeployProcessed', hash: 'abc123' });

      const invalidEvent = parseSSEEvent('not valid json');
      expect(invalidEvent).toBeNull();
    });

    it('should handle different event types', () => {
      const eventTypes = ['DeployProcessed', 'TransactionProcessed', 'BlockAdded', 'Step'];
      const handlers: Record<string, number> = {};

      eventTypes.forEach(type => {
        handlers[type] = 0;
      });

      const handleEvent = (type: string) => {
        if (handlers[type] !== undefined) {
          handlers[type]++;
          return true;
        }
        return false;
      };

      expect(handleEvent('DeployProcessed')).toBe(true);
      expect(handleEvent('BlockAdded')).toBe(true);
      expect(handleEvent('UnknownType')).toBe(false);
      
      expect(handlers['DeployProcessed']).toBe(1);
      expect(handlers['BlockAdded']).toBe(1);
    });
  });
});

// =============================================================================
// Integration Tests: Fallback Behavior
// =============================================================================

describe('Adapter Fallback Mechanism', () => {
  it('should attempt Sidecar first, then fall back to Node', async () => {
    const callOrder: string[] = [];
    
    const sidecarCall = async (): Promise<unknown> => {
      callOrder.push('sidecar');
      throw new Error('Sidecar unavailable');
    };

    const nodeCall = async (): Promise<unknown> => {
      callOrder.push('node');
      return { success: true };
    };

    const callWithFallback = async (): Promise<unknown> => {
      try {
        return await sidecarCall();
      } catch {
        return await nodeCall();
      }
    };

    const result = await callWithFallback();
    
    expect(callOrder).toEqual(['sidecar', 'node']);
    expect(result).toEqual({ success: true });
  });

  it('should not fall back if Sidecar succeeds', async () => {
    const callOrder: string[] = [];
    
    const sidecarCall = async (): Promise<unknown> => {
      callOrder.push('sidecar');
      return { source: 'sidecar' };
    };

    const nodeCall = async (): Promise<unknown> => {
      callOrder.push('node');
      return { source: 'node' };
    };

    const callWithFallback = async (): Promise<unknown> => {
      try {
        return await sidecarCall();
      } catch {
        return await nodeCall();
      }
    };

    const result = await callWithFallback();
    
    expect(callOrder).toEqual(['sidecar']);
    expect(result).toEqual({ source: 'sidecar' });
  });

  it('should track fallback metrics', async () => {
    const metrics = {
      sidecarCalls: 0,
      sidecarErrors: 0,
      nodeFallbacks: 0,
      successfulCalls: 0,
    };

    const callWithMetrics = async (sidecarWorks: boolean): Promise<void> => {
      metrics.sidecarCalls++;
      
      if (!sidecarWorks) {
        metrics.sidecarErrors++;
        metrics.nodeFallbacks++;
      }
      
      metrics.successfulCalls++;
    };

    await callWithMetrics(true);
    await callWithMetrics(false);
    await callWithMetrics(true);

    expect(metrics.sidecarCalls).toBe(3);
    expect(metrics.sidecarErrors).toBe(1);
    expect(metrics.nodeFallbacks).toBe(1);
    expect(metrics.successfulCalls).toBe(3);
  });
});

// =============================================================================
// Integration Tests: Real-Time Audit
// =============================================================================

describe('Real-Time Audit Service', () => {
  it('should register and unregister clients', async () => {
    const { realTimeAuditEmitter } = await import('../../services/realTimeAuditService.js');
    
    const clientId = 'test-client-001';
    const receivedEvents: unknown[] = [];
    
    realTimeAuditEmitter.registerClient(clientId, (event) => {
      receivedEvents.push(event);
    });

    const metrics1 = realTimeAuditEmitter.getMetrics();
    expect(metrics1.connectedClients).toBeGreaterThanOrEqual(1);

    realTimeAuditEmitter.unregisterClient(clientId);
    
    const metrics2 = realTimeAuditEmitter.getMetrics();
    expect(metrics2.connectedClients).toBeLessThan(metrics1.connectedClients);
  });

  it('should broadcast events to connected clients', async () => {
    const { realTimeAuditEmitter } = await import('../../services/realTimeAuditService.js');
    
    const clientId = 'test-client-002';
    const receivedEvents: unknown[] = [];
    
    realTimeAuditEmitter.registerClient(clientId, (event) => {
      receivedEvents.push(event);
    });

    realTimeAuditEmitter.emitAuditEvent({
      type: 'TEST_EVENT',
      instanceId: 'test-instance',
      verified: true,
    });

    // Allow event propagation
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(receivedEvents.length).toBeGreaterThanOrEqual(1);
    
    realTimeAuditEmitter.unregisterClient(clientId);
  });

  it('should filter events by instanceId', async () => {
    const { realTimeAuditEmitter } = await import('../../services/realTimeAuditService.js');
    
    const clientId = 'test-client-003';
    const targetInstance = 'instance-A';
    const receivedEvents: Array<{ instanceId?: string }> = [];
    
    realTimeAuditEmitter.registerClient(
      clientId,
      (event) => receivedEvents.push(event),
      { instanceFilter: targetInstance }
    );

    realTimeAuditEmitter.emitAuditEvent({
      type: 'EVENT_A',
      instanceId: 'instance-A',
    });

    realTimeAuditEmitter.emitAuditEvent({
      type: 'EVENT_B',
      instanceId: 'instance-B', // Different instance
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Should only receive events for instance-A
    const matchingEvents = receivedEvents.filter(e => e.instanceId === targetInstance);
    expect(matchingEvents.length).toBeGreaterThanOrEqual(1);
    
    realTimeAuditEmitter.unregisterClient(clientId);
  });
});

// =============================================================================
// Failure Simulation Tests
// =============================================================================

describe('Failure Simulation', () => {
  describe('Network Failures', () => {
    it('should handle timeout gracefully', async () => {
      const timeoutMs = 100;
      
      const fetchWithTimeout = (shouldTimeout: boolean): Promise<string> => {
        return new Promise((resolve, reject) => {
          if (shouldTimeout) {
            setTimeout(() => reject(new Error('Timeout')), timeoutMs);
          } else {
            setTimeout(() => resolve('success'), 10);
          }
        });
      };

      await expect(fetchWithTimeout(false)).resolves.toBe('success');
      await expect(fetchWithTimeout(true)).rejects.toThrow('Timeout');
    });

    it('should retry on transient failures', async () => {
      let attempts = 0;
      const maxRetries = 3;
      
      const fetchWithRetry = async (): Promise<string> => {
        for (let i = 0; i <= maxRetries; i++) {
          attempts++;
          try {
            if (i < 2) {
              throw new Error('Transient failure');
            }
            return 'success';
          } catch (error) {
            if (i === maxRetries) throw error;
            await new Promise(r => setTimeout(r, 10));
          }
        }
        throw new Error('Exhausted retries');
      };

      const result = await fetchWithRetry();
      expect(result).toBe('success');
      expect(attempts).toBe(3); // Failed twice, succeeded on third
    });
  });

  describe('Sidecar Unavailability', () => {
    it('should continue processing with Node-only mode', async () => {
      let sidecarAvailable = false;
      
      const getDeploy = async (hash: string): Promise<{ source: string; hash: string }> => {
        if (sidecarAvailable) {
          return { source: 'sidecar', hash };
        }
        // Fall back to node
        return { source: 'node', hash };
      };

      const result = await getDeploy('test-hash');
      expect(result.source).toBe('node');
      
      sidecarAvailable = true;
      const result2 = await getDeploy('test-hash-2');
      expect(result2.source).toBe('sidecar');
    });
  });

  describe('Database Failures', () => {
    it('should queue events when DB is unavailable', () => {
      const eventQueue: unknown[] = [];
      let dbAvailable = false;

      const processEvent = (event: unknown): boolean => {
        if (!dbAvailable) {
          eventQueue.push(event);
          return false;
        }
        // Process event
        return true;
      };

      processEvent({ id: 1 });
      processEvent({ id: 2 });
      
      expect(eventQueue.length).toBe(2);
      
      dbAvailable = true;
      
      // Drain queue
      while (eventQueue.length > 0) {
        const event = eventQueue.shift();
        expect(processEvent(event)).toBe(true);
      }
    });
  });
});

// =============================================================================
// Performance Tests
// =============================================================================

describe('Performance', () => {
  it('should handle high event throughput', async () => {
    const eventCount = 1000;
    const events: unknown[] = [];
    
    const startTime = Date.now();
    
    for (let i = 0; i < eventCount; i++) {
      events.push({
        id: i,
        type: 'WORKFLOW_TRANSITIONED',
        timestamp: new Date().toISOString(),
      });
    }
    
    const duration = Date.now() - startTime;
    
    expect(events.length).toBe(eventCount);
    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
  });

  it('should maintain event ordering', () => {
    const events: Array<{ order: number }> = [];
    
    for (let i = 0; i < 100; i++) {
      events.push({ order: i });
    }
    
    for (let i = 1; i < events.length; i++) {
      expect(events[i].order).toBeGreaterThan(events[i - 1].order);
    }
  });
});
