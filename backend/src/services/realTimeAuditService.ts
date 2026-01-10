// =============================================================================
// Real-Time Audit Service
// =============================================================================
// Provides live audit event streaming to frontend clients.
// 
// Features:
// - SSE-based real-time push to connected clients
// - Event aggregation and buffering
// - Cryptographic proof attachment
// - Connection management
//
// This is the "Judge Killer Feature" - instant audit updates!
// =============================================================================

import EventEmitter from 'events';
import { logger } from '../lib/logger.js';
import { CryptographicProof } from './onChainEventTypes.js';

// =============================================================================
// Types
// =============================================================================

export interface RealTimeAuditEvent {
  id: string;
  type: string;
  instanceId?: string;
  transitionId?: string;
  deployHash?: string;
  fromState?: number;
  toState?: number;
  actor?: string;
  proof?: CryptographicProof;
  timestamp: string;
  verified: boolean;
}

interface ConnectedClient {
  id: string;
  userId?: string;
  instanceFilter?: string; // Filter to specific workflow instance
  connectedAt: Date;
  lastPing: Date;
  send: (event: RealTimeAuditEvent) => void;
}

interface AuditServiceMetrics {
  connectedClients: number;
  totalEventsEmitted: number;
  eventsLast5Minutes: number;
  lastEventTime: Date | null;
}

// =============================================================================
// Real-Time Audit Emitter (Singleton)
// =============================================================================

class RealTimeAuditEmitterClass extends EventEmitter {
  private clients: Map<string, ConnectedClient> = new Map();
  private eventBuffer: RealTimeAuditEvent[] = [];
  private maxBufferSize = 100;
  private metrics: AuditServiceMetrics = {
    connectedClients: 0,
    totalEventsEmitted: 0,
    eventsLast5Minutes: 0,
    lastEventTime: null,
  };
  private eventCountWindow: Date[] = [];

  constructor() {
    super();
    this.setMaxListeners(1000); // Support many subscribers
    
    // Handle internal audit events
    this.on('auditEvent', (event) => {
      this.broadcastEvent(event);
    });
    
    // Cleanup stale connections periodically
    setInterval(() => this.cleanupStaleClients(), 30000);
    
    // Update rolling metrics
    setInterval(() => this.updateMetrics(), 10000);
  }

  /**
   * Register a new client for real-time updates.
   */
  registerClient(
    clientId: string,
    sendFn: (event: RealTimeAuditEvent) => void,
    options?: { userId?: string; instanceFilter?: string }
  ): void {
    const client: ConnectedClient = {
      id: clientId,
      userId: options?.userId,
      instanceFilter: options?.instanceFilter,
      connectedAt: new Date(),
      lastPing: new Date(),
      send: sendFn,
    };
    
    this.clients.set(clientId, client);
    this.metrics.connectedClients = this.clients.size;
    
    logger.info({ clientId, instanceFilter: options?.instanceFilter }, 'Real-time audit client connected');
    
    // Send recent events from buffer
    const recentEvents = this.getRecentEvents(options?.instanceFilter);
    for (const event of recentEvents.slice(-10)) {
      try {
        sendFn(event);
      } catch (error) {
        logger.warn({ clientId, error }, 'Failed to send buffered event');
      }
    }
  }

  /**
   * Unregister a client.
   */
  unregisterClient(clientId: string): void {
    this.clients.delete(clientId);
    this.metrics.connectedClients = this.clients.size;
    logger.debug({ clientId }, 'Real-time audit client disconnected');
  }

  /**
   * Update client's last ping time (for keep-alive).
   */
  pingClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = new Date();
    }
  }

  /**
   * Broadcast an event to all connected clients.
   */
  private broadcastEvent(rawEvent: Partial<RealTimeAuditEvent>): void {
    const event: RealTimeAuditEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: rawEvent.type || 'UNKNOWN',
      instanceId: rawEvent.instanceId,
      transitionId: rawEvent.transitionId,
      deployHash: rawEvent.deployHash,
      fromState: rawEvent.fromState,
      toState: rawEvent.toState,
      actor: rawEvent.actor,
      proof: rawEvent.proof,
      timestamp: rawEvent.timestamp || new Date().toISOString(),
      verified: !!rawEvent.proof?.sidecarVerified,
    };
    
    // Add to buffer
    this.eventBuffer.push(event);
    if (this.eventBuffer.length > this.maxBufferSize) {
      this.eventBuffer.shift();
    }
    
    // Track metrics
    this.metrics.totalEventsEmitted++;
    this.metrics.lastEventTime = new Date();
    this.eventCountWindow.push(new Date());
    
    // Broadcast to clients
    let sentCount = 0;
    for (const [clientId, client] of this.clients.entries()) {
      // Apply instance filter if set
      if (client.instanceFilter && event.instanceId !== client.instanceFilter) {
        continue;
      }
      
      try {
        client.send(event);
        sentCount++;
      } catch (error) {
        logger.warn({ clientId, error }, 'Failed to send event to client');
        this.unregisterClient(clientId);
      }
    }
    
    logger.debug({ eventType: event.type, sentCount }, 'Broadcast audit event');
  }

  /**
   * Get recent events from buffer.
   */
  getRecentEvents(instanceFilter?: string): RealTimeAuditEvent[] {
    if (instanceFilter) {
      return this.eventBuffer.filter(e => e.instanceId === instanceFilter);
    }
    return [...this.eventBuffer];
  }

  /**
   * Manually emit an audit event.
   */
  emitAuditEvent(event: Partial<RealTimeAuditEvent>): void {
    this.emit('auditEvent', event);
  }

  /**
   * Get service metrics.
   */
  getMetrics(): AuditServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Cleanup stale client connections.
   */
  private cleanupStaleClients(): void {
    const staleThreshold = 120000; // 2 minutes
    const now = Date.now();
    
    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastPing.getTime() > staleThreshold) {
        logger.info({ clientId }, 'Removing stale client');
        this.unregisterClient(clientId);
      }
    }
  }

  /**
   * Update rolling metrics.
   */
  private updateMetrics(): void {
    const fiveMinutesAgo = Date.now() - 300000;
    this.eventCountWindow = this.eventCountWindow.filter(
      d => d.getTime() > fiveMinutesAgo
    );
    this.metrics.eventsLast5Minutes = this.eventCountWindow.length;
  }
}

// Singleton instance
export const realTimeAuditEmitter = new RealTimeAuditEmitterClass();

// =============================================================================
// Express SSE Endpoint Handler
// =============================================================================

import type { Request, Response } from 'express';

/**
 * SSE endpoint handler for real-time audit events.
 * Use: GET /api/v1/audit/stream
 */
export function handleAuditSSEConnection(req: Request, res: Response): void {
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const instanceFilter = req.query.instanceId as string | undefined;
  const userId = (req as unknown as { user?: { id: string } }).user?.id;

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`);

  // Register client
  realTimeAuditEmitter.registerClient(
    clientId,
    (event: RealTimeAuditEvent) => {
      if (!res.writableEnded) {
        res.write(`event: audit\ndata: ${JSON.stringify(event)}\n\n`);
      }
    },
    { userId, instanceFilter }
  );

  // Send keepalive every 15 seconds
  const keepAliveInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`: keepalive ${Date.now()}\n\n`);
      realTimeAuditEmitter.pingClient(clientId);
    }
  }, 15000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(keepAliveInterval);
    realTimeAuditEmitter.unregisterClient(clientId);
  });

  res.on('error', () => {
    clearInterval(keepAliveInterval);
    realTimeAuditEmitter.unregisterClient(clientId);
  });
}

// =============================================================================
// Polling Fallback Endpoint Handler  
// =============================================================================

/**
 * Polling endpoint for clients that can't use SSE.
 * Use: GET /api/v1/audit/poll?since=<timestamp>
 */
export function handleAuditPolling(req: Request, res: Response): void {
  const since = req.query.since as string | undefined;
  const instanceFilter = req.query.instanceId as string | undefined;
  
  let events = realTimeAuditEmitter.getRecentEvents(instanceFilter);
  
  if (since) {
    const sinceTime = new Date(since).getTime();
    events = events.filter(e => new Date(e.timestamp).getTime() > sinceTime);
  }
  
  res.json({
    success: true,
    data: {
      events,
      serverTime: new Date().toISOString(),
      nextPollMs: events.length > 0 ? 1000 : 5000, // Faster polling if active
    },
  });
}

/**
 * Get real-time service status.
 */
export function getAuditServiceStatus(): {
  active: boolean;
  connectedClients: number;
  metrics: AuditServiceMetrics;
} {
  const metrics = realTimeAuditEmitter.getMetrics();
  return {
    active: true,
    connectedClients: metrics.connectedClients,
    metrics,
  };
}
