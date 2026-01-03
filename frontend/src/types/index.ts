// =============================================================================
// Type Definitions
// =============================================================================

// User & Auth Types
export interface User {
  id: string;
  email: string;
  publicKey: string | null;
  accountHash: string | null;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  roles?: string[];  // Backend returns role names as strings
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  bitmask: number;
  isSystem: boolean;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  orgId: string | null;
  templateId: string | null;
  role: Role;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Organization Types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  plan: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Workflow Types
export interface WorkflowTemplate {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  version: number;
  states: WorkflowState[];
  transitions: WorkflowTransitionDef[];
  slaDays: number;
  escalationDays: number;
  autoEscalate: boolean;
  metadata: Record<string, unknown>;
  contractHash: string | null;
  status: TemplateStatus;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TemplateStatus = 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'ARCHIVED';

export interface WorkflowState {
  id: number;
  name: string;
  description?: string;
  color?: string;
  isInitial?: boolean;
  isTerminal?: boolean;
}

export interface WorkflowTransitionDef {
  from: number;
  to: number;
  action: string;
  requiredRole?: number; // Role bitmask
  label?: string;
}

export interface WorkflowInstance {
  id: string;
  orgId: string;
  templateId: string;
  creatorId: string;
  title: string;
  description: string | null;
  data: Record<string, unknown>;
  currentState: number;
  status: InstanceStatus;
  workflowId: string | null;
  deployHash: string | null;
  dueDate: string | null;
  escalationDate: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  template?: WorkflowTemplate;
  creator?: User;
  transitions?: WorkflowTransition[];
}

export type InstanceStatus = 'DRAFT' | 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'ESCALATED';

export interface WorkflowTransition {
  id: string;
  instanceId: string;
  actorId: string;
  fromState: number;
  toState: number;
  action: string;
  deployHash: string | null;
  blockHeight: string | null;
  status: TransitionStatus;
  error: string | null;
  comment: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  confirmedAt: string | null;
  actor?: User;
}

export type TransitionStatus = 'PENDING' | 'CONFIRMED' | 'FAILED' | 'TIMEOUT';

// Audit Types
export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  deployHash: string | null;
  createdAt: string;
  user?: User | null;
}

// Alias for AuditLog for backwards compatibility
export type AuditLogEntry = AuditLog;

// API Response Types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// Casper Types
export interface CasperDeploy {
  deployHash: string;
  account: string;
  timestamp: string;
  ttl: string;
  dependencies: string[];
  gasPrice: number;
  bodyHash: string;
  session: unknown;
  payment: unknown;
  approvals: Array<{
    signer: string;
    signature: string;
  }>;
}

export interface CasperDeployResult {
  deployHash: string;
  executionResults: Array<{
    blockHash: string;
    result: {
      Success?: {
        cost: string;
        effect: unknown;
        transfers: string[];
      };
      Failure?: {
        cost: string;
        errorMessage: string;
      };
    };
  }>;
}

// Form Types
export interface CreateWorkflowForm {
  templateId: string;
  title: string;
  description?: string;
  data?: Record<string, unknown>;
}

export interface TransitionForm {
  action: string;
  toState: number;
  comment?: string;
}
