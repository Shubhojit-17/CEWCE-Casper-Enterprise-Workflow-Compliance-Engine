// =============================================================================
// On-Chain Event Types for CEWCE
// =============================================================================
// These types represent events emitted by the Casper smart contract
// and processed by the Sidecar SSE listener.
// =============================================================================

/**
 * Base interface for all on-chain events.
 */
export interface OnChainEvent {
  eventType: OnChainEventType;
  deployHash: string;
  blockHash: string;
  blockHeight: number;
  timestamp: string;
  stateRootHash: string;
  contractHash: string;
}

/**
 * Supported on-chain event types from the workflow contract.
 */
export enum OnChainEventType {
  WORKFLOW_CREATED = 'workflow_created',
  WORKFLOW_TRANSITIONED = 'workflow_transitioned',
  ROLE_GRANTED = 'role_granted',
  ROLE_REVOKED = 'role_revoked',
  AUDIT_RECORDED = 'audit_recorded',
}

/**
 * Event emitted when a new workflow is created on-chain.
 */
export interface WorkflowCreatedEvent extends OnChainEvent {
  eventType: OnChainEventType.WORKFLOW_CREATED;
  data: {
    workflowId: string;
    templateHash: string;
    dataHash: string;
    creator: string;
    initialState: number;
  };
}

/**
 * Event emitted when a workflow state transition occurs.
 */
export interface WorkflowTransitionedEvent extends OnChainEvent {
  eventType: OnChainEventType.WORKFLOW_TRANSITIONED;
  data: {
    workflowId: string;
    fromState: number;
    toState: number;
    actor: string;
    actorRole: number;
    commentHash: string;
  };
}

/**
 * Event emitted when a role is granted to a user.
 */
export interface RoleGrantedEvent extends OnChainEvent {
  eventType: OnChainEventType.ROLE_GRANTED;
  data: {
    user: string;
    role: number;
    grantor: string;
  };
}

/**
 * Event emitted when a role is revoked from a user.
 */
export interface RoleRevokedEvent extends OnChainEvent {
  eventType: OnChainEventType.ROLE_REVOKED;
  data: {
    user: string;
    role: number;
    revoker: string;
  };
}

/**
 * Audit event recorded on-chain.
 */
export interface AuditRecordedEvent extends OnChainEvent {
  eventType: OnChainEventType.AUDIT_RECORDED;
  data: {
    entityType: string;
    entityId: string;
    action: string;
    actorHash: string;
    dataHash: string;
  };
}

/**
 * Union type for all on-chain events.
 */
export type ContractEvent =
  | WorkflowCreatedEvent
  | WorkflowTransitionedEvent
  | RoleGrantedEvent
  | RoleRevokedEvent
  | AuditRecordedEvent;

/**
 * Cryptographic proof object for audit verification.
 * Note: Uses index signature for Prisma JSON compatibility.
 */
export interface CryptographicProof {
  [key: string]: string | number | boolean | null | undefined;
  eventHash: string;        // SHA-256 of event data
  deployHash: string | null;       // Deploy/transaction hash
  blockHash: string | null;        // Block containing the deploy
  blockHeight: number | null;      // Block height
  stateRootHash: string | null;    // State root after execution
  contractHash: string | null;     // Contract that emitted event
  timestamp?: string;        // Block timestamp
  sidecarVerified: boolean; // Verified via Sidecar
  verificationTimestamp: string;
}

/**
 * Event processing result.
 */
export interface EventProcessingResult {
  success: boolean;
  eventId: string;
  eventType: OnChainEventType;
  isDuplicate: boolean;
  dbRecordId?: string;
  error?: string;
}

/**
 * Event reconciliation status.
 */
export interface ReconciliationStatus {
  inSync: boolean;
  offChainCount: number;
  onChainCount: number;
  missingOnChain: string[];
  missingOffChain: string[];
  lastReconciliation: string;
}
