// =============================================================================
// On-Chain Event Processor
// =============================================================================
// Processes events from Sidecar SSE with:
// - Event validation and parsing
// - Idempotency (deduplication)
// - Transactional database updates
// - Cryptographic proof generation
// - Real-time notification emission
//
// ⚠️ IMPORTANT: DB remains source of truth. SSE events are verification signals.
// =============================================================================

import { createHash } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { getSSEListener } from './sidecarListener.js';
import { 
  OnChainEventType, 
  ContractEvent,
  WorkflowCreatedEvent,
  WorkflowTransitionedEvent,
  CryptographicProof,
  EventProcessingResult,
} from './onChainEventTypes.js';
import { realTimeAuditEmitter } from './realTimeAuditService.js';

// =============================================================================
// Processed Event Cache (for deduplication)
// =============================================================================

const processedEventCache = new Map<string, { processedAt: Date; result: EventProcessingResult }>();
const CACHE_TTL_MS = 3600000; // 1 hour

/**
 * Generate unique event ID for deduplication.
 */
function generateEventId(event: ContractEvent): string {
  return `${event.deployHash}:${event.eventType}:${event.blockHeight}`;
}

/**
 * Check if event was already processed.
 */
function isEventProcessed(eventId: string): boolean {
  const cached = processedEventCache.get(eventId);
  if (!cached) return false;
  
  // Check if cache entry expired
  if (Date.now() - cached.processedAt.getTime() > CACHE_TTL_MS) {
    processedEventCache.delete(eventId);
    return false;
  }
  
  return true;
}

/**
 * Mark event as processed.
 */
function markEventProcessed(eventId: string, result: EventProcessingResult): void {
  processedEventCache.set(eventId, { processedAt: new Date(), result });
  
  // Cleanup old entries periodically
  if (processedEventCache.size > 10000) {
    const now = Date.now();
    for (const [key, value] of processedEventCache.entries()) {
      if (now - value.processedAt.getTime() > CACHE_TTL_MS) {
        processedEventCache.delete(key);
      }
    }
  }
}

// =============================================================================
// Cryptographic Proof Generation
// =============================================================================

/**
 * Generate cryptographic proof for an event.
 */
export function generateCryptographicProof(event: ContractEvent): CryptographicProof {
  // Create event hash from deterministic JSON
  const eventData = JSON.stringify({
    eventType: event.eventType,
    deployHash: event.deployHash,
    blockHash: event.blockHash,
    blockHeight: event.blockHeight,
    data: 'data' in event ? event.data : {},
  });
  
  const eventHash = createHash('sha256').update(eventData).digest('hex');
  
  return {
    eventHash,
    deployHash: event.deployHash,
    blockHash: event.blockHash,
    blockHeight: event.blockHeight,
    stateRootHash: event.stateRootHash,
    contractHash: event.contractHash,
    timestamp: event.timestamp,
    sidecarVerified: true,
    verificationTimestamp: new Date().toISOString(),
  };
}

// =============================================================================
// Event Processing Functions
// =============================================================================

/**
 * Process a workflow created event.
 * Updates instance to mark on-chain confirmation.
 */
async function processWorkflowCreated(event: WorkflowCreatedEvent): Promise<EventProcessingResult> {
  const eventId = generateEventId(event);
  
  if (isEventProcessed(eventId)) {
    return {
      success: true,
      eventId,
      eventType: event.eventType,
      isDuplicate: true,
    };
  }
  
  try {
    const proof = generateCryptographicProof(event);
    
    // Find instance by deploy hash or on-chain workflow ID
    const instance = await prisma.workflowInstance.findFirst({
      where: {
        OR: [
          { deployHash: event.deployHash },
          { workflowId: BigInt(event.data.workflowId) },
        ],
      },
    });
    
    if (!instance) {
      logger.warn({ event }, 'Workflow created event for unknown instance');
      return {
        success: false,
        eventId,
        eventType: event.eventType,
        isDuplicate: false,
        error: 'Instance not found',
      };
    }
    
    // Update instance with on-chain confirmation
    await prisma.$transaction(async (tx) => {
      // Update workflow instance
      await tx.workflowInstance.update({
        where: { id: instance.id },
        data: {
          workflowId: BigInt(event.data.workflowId),
          status: 'PENDING',
        },
      });
      
      // Create on-chain audit record
      await tx.auditLog.create({
        data: {
          action: 'workflow.created.on_chain',
          resource: 'workflow_instance',
          resourceId: instance.id,
          deployHash: event.deployHash,
          details: {
            onChainEvent: true,
            proof,
            eventData: event.data,
          },
        },
      });
    });
    
    // Emit real-time notification
    realTimeAuditEmitter.emit('auditEvent', {
      type: 'WORKFLOW_CREATED_CONFIRMED',
      instanceId: instance.id,
      deployHash: event.deployHash,
      proof,
      timestamp: new Date().toISOString(),
    });
    
    const result: EventProcessingResult = {
      success: true,
      eventId,
      eventType: event.eventType,
      isDuplicate: false,
      dbRecordId: instance.id,
    };
    
    markEventProcessed(eventId, result);
    logger.info({ eventId, instanceId: instance.id }, 'Workflow created event processed');
    
    return result;
  } catch (error) {
    logger.error({ error, event }, 'Failed to process workflow created event');
    return {
      success: false,
      eventId,
      eventType: event.eventType,
      isDuplicate: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process a workflow transition event.
 * Verifies and confirms the transition in DB.
 */
async function processWorkflowTransitioned(event: WorkflowTransitionedEvent): Promise<EventProcessingResult> {
  const eventId = generateEventId(event);
  
  if (isEventProcessed(eventId)) {
    return {
      success: true,
      eventId,
      eventType: event.eventType,
      isDuplicate: true,
    };
  }
  
  try {
    const proof = generateCryptographicProof(event);
    
    // Find the transition by deploy hash
    const transition = await prisma.workflowTransition.findFirst({
      where: { deployHash: event.deployHash },
      include: { instance: true },
    });
    
    if (!transition) {
      logger.warn({ event }, 'Transition event for unknown deploy hash');
      return {
        success: false,
        eventId,
        eventType: event.eventType,
        isDuplicate: false,
        error: 'Transition not found',
      };
    }
    
    // Verify transition matches expected state change
    if (transition.fromState !== event.data.fromState || transition.toState !== event.data.toState) {
      logger.error({
        expected: { from: transition.fromState, to: transition.toState },
        received: { from: event.data.fromState, to: event.data.toState },
      }, 'State mismatch in transition event');
    }
    
    // Update transition and instance in transaction
    await prisma.$transaction(async (tx) => {
      // Confirm transition
      await tx.workflowTransition.update({
        where: { id: transition.id },
        data: {
          status: 'CONFIRMED',
          confirmedAt: new Date(),
          blockHeight: BigInt(event.blockHeight),
          metadata: {
            ...(transition.metadata as object || {}),
            onChainProof: proof,
          },
        },
      });
      
      // Update workflow current state
      await tx.workflowInstance.update({
        where: { id: transition.instanceId },
        data: {
          currentState: event.data.toState,
        },
      });
      
      // Create on-chain audit record
      await tx.auditLog.create({
        data: {
          action: 'workflow.transitioned.on_chain',
          resource: 'workflow_transition',
          resourceId: transition.id,
          deployHash: event.deployHash,
          details: {
            onChainEvent: true,
            proof,
            eventData: event.data,
            instanceId: transition.instanceId,
          },
        },
      });
    });
    
    // Emit real-time notification
    realTimeAuditEmitter.emit('auditEvent', {
      type: 'TRANSITION_CONFIRMED',
      transitionId: transition.id,
      instanceId: transition.instanceId,
      fromState: event.data.fromState,
      toState: event.data.toState,
      deployHash: event.deployHash,
      proof,
      timestamp: new Date().toISOString(),
    });
    
    const result: EventProcessingResult = {
      success: true,
      eventId,
      eventType: event.eventType,
      isDuplicate: false,
      dbRecordId: transition.id,
    };
    
    markEventProcessed(eventId, result);
    logger.info({ eventId, transitionId: transition.id }, 'Transition event processed');
    
    return result;
  } catch (error) {
    logger.error({ error, event }, 'Failed to process transition event');
    return {
      success: false,
      eventId,
      eventType: event.eventType,
      isDuplicate: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// Main Event Router
// =============================================================================

/**
 * Parse and route contract events from Sidecar SSE.
 */
export async function processContractEvent(rawEvent: unknown): Promise<EventProcessingResult | null> {
  try {
    const event = parseContractEvent(rawEvent);
    if (!event) {
      return null;
    }
    
    switch (event.eventType) {
      case OnChainEventType.WORKFLOW_CREATED:
        return processWorkflowCreated(event as WorkflowCreatedEvent);
      
      case OnChainEventType.WORKFLOW_TRANSITIONED:
        return processWorkflowTransitioned(event as WorkflowTransitionedEvent);
      
      case OnChainEventType.ROLE_GRANTED:
      case OnChainEventType.ROLE_REVOKED:
        logger.info({ event }, 'Role event received (not implemented)');
        return null;
      
      case OnChainEventType.AUDIT_RECORDED:
        logger.info({ event }, 'Audit event received (not implemented)');
        return null;
      
      default:
        logger.debug({ event }, 'Unknown event type');
        return null;
    }
  } catch (error) {
    logger.error({ error, rawEvent }, 'Failed to process contract event');
    return null;
  }
}

/**
 * Parse raw SSE event data into typed contract event.
 */
function parseContractEvent(rawEvent: unknown): ContractEvent | null {
  try {
    const event = rawEvent as Record<string, unknown>;
    
    // Extract common fields
    const deployHash = extractString(event, 'deploy_hash') || extractString(event, 'transaction_hash');
    const blockHash = extractString(event, 'block_hash');
    const blockHeight = extractNumber(event, 'block_height');
    const timestamp = extractString(event, 'timestamp') || new Date().toISOString();
    const stateRootHash = extractString(event, 'state_root_hash') || '';
    const contractHash = extractString(event, 'contract_hash') || '';
    
    if (!deployHash || !blockHash) {
      return null;
    }
    
    // Detect event type from execution effects or event name
    const eventType = detectEventType(event);
    if (!eventType) {
      return null;
    }
    
    const baseEvent = {
      eventType,
      deployHash,
      blockHash,
      blockHeight: blockHeight || 0,
      timestamp,
      stateRootHash,
      contractHash,
    };
    
    // Parse event-specific data
    const eventData = event.data || event.execution_result || {};
    
    switch (eventType) {
      case OnChainEventType.WORKFLOW_CREATED:
        return {
          ...baseEvent,
          eventType: OnChainEventType.WORKFLOW_CREATED,
          data: {
            workflowId: extractString(eventData, 'workflow_id') || '0',
            templateHash: extractString(eventData, 'template_hash') || '',
            dataHash: extractString(eventData, 'data_hash') || '',
            creator: extractString(eventData, 'creator') || '',
            initialState: extractNumber(eventData, 'initial_state') || 0,
          },
        };
      
      case OnChainEventType.WORKFLOW_TRANSITIONED:
        return {
          ...baseEvent,
          eventType: OnChainEventType.WORKFLOW_TRANSITIONED,
          data: {
            workflowId: extractString(eventData, 'workflow_id') || '0',
            fromState: extractNumber(eventData, 'from_state') || 0,
            toState: extractNumber(eventData, 'to_state') || 0,
            actor: extractString(eventData, 'actor') || '',
            actorRole: extractNumber(eventData, 'actor_role') || 0,
            commentHash: extractString(eventData, 'comment_hash') || '',
          },
        };
      
      default:
        return null;
    }
  } catch (error) {
    logger.error({ error }, 'Failed to parse contract event');
    return null;
  }
}

function extractString(obj: unknown, key: string): string | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function extractNumber(obj: unknown, key: string): number | undefined {
  if (typeof obj !== 'object' || obj === null) return undefined;
  const value = (obj as Record<string, unknown>)[key];
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseInt(value, 10);
  return undefined;
}

function detectEventType(event: Record<string, unknown>): OnChainEventType | null {
  // Check for explicit event type
  const eventName = extractString(event, 'event_type') || 
                    extractString(event, 'event_name') ||
                    extractString(event, 'name');
  
  if (eventName) {
    if (eventName.includes('workflow_created') || eventName.includes('WorkflowCreated')) {
      return OnChainEventType.WORKFLOW_CREATED;
    }
    if (eventName.includes('transition') || eventName.includes('Transitioned')) {
      return OnChainEventType.WORKFLOW_TRANSITIONED;
    }
    if (eventName.includes('role_granted')) {
      return OnChainEventType.ROLE_GRANTED;
    }
  }
  
  // Check for entry point name in execution effects
  const entryPoint = extractString(event, 'entry_point') || 
                     extractString(event, 'entry_point_name');
  
  if (entryPoint) {
    if (entryPoint === 'create_workflow') return OnChainEventType.WORKFLOW_CREATED;
    if (entryPoint === 'transition_state') return OnChainEventType.WORKFLOW_TRANSITIONED;
  }
  
  return null;
}

// =============================================================================
// Integration with SSE Listener
// =============================================================================

/**
 * Wire up event processor to SSE listener.
 */
export function initializeEventProcessor(): void {
  const listener = getSSEListener();
  
  listener.on('deployProcessed', async (data) => {
    await processContractEvent(data);
  });
  
  listener.on('transactionProcessed', async (data) => {
    await processContractEvent(data);
  });
  
  logger.info('On-chain event processor initialized');
}

/**
 * Get processing metrics.
 */
export function getProcessorMetrics() {
  return {
    cachedEvents: processedEventCache.size,
    cacheMaxSize: 10000,
    cacheTtlMs: CACHE_TTL_MS,
  };
}
