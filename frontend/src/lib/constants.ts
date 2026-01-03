/**
 * CEWCE Application Constants
 */

// Workflow States (matching smart contract)
export const WORKFLOW_STATES = {
  DRAFT: { value: 0, label: 'Draft', color: 'gray' },
  PENDING_REVIEW: { value: 1, label: 'Pending Review', color: 'yellow' },
  IN_REVIEW: { value: 2, label: 'In Review', color: 'blue' },
  PENDING_APPROVAL: { value: 3, label: 'Pending Approval', color: 'orange' },
  APPROVED: { value: 10, label: 'Approved', color: 'green' },
  REJECTED: { value: 11, label: 'Rejected', color: 'red' },
  ESCALATED: { value: 20, label: 'Escalated', color: 'purple' },
  CANCELLED: { value: 30, label: 'Cancelled', color: 'gray' },
} as const;

// Workflow Actions
export const WORKFLOW_ACTIONS = {
  SUBMIT_FOR_REVIEW: 'submit_for_review',
  START_REVIEW: 'start_review',
  REQUEST_APPROVAL: 'request_approval',
  APPROVE: 'approve',
  REJECT: 'reject',
  ESCALATE: 'escalate',
  CANCEL: 'cancel',
  RESUBMIT: 'resubmit',
} as const;

// Role Types
export const ROLES = {
  ADMIN: 'ADMIN',
  WORKFLOW_ADMIN: 'WORKFLOW_ADMIN',
  REVIEWER: 'REVIEWER',
  APPROVER: 'APPROVER',
  USER: 'USER',
  AUDITOR: 'AUDITOR',
} as const;

// Permissions
export const PERMISSIONS = {
  // Workflow permissions
  CREATE_WORKFLOW: 'workflow:create',
  READ_WORKFLOW: 'workflow:read',
  UPDATE_WORKFLOW: 'workflow:update',
  DELETE_WORKFLOW: 'workflow:delete',
  APPROVE_WORKFLOW: 'workflow:approve',
  REJECT_WORKFLOW: 'workflow:reject',
  
  // Template permissions
  CREATE_TEMPLATE: 'template:create',
  READ_TEMPLATE: 'template:read',
  UPDATE_TEMPLATE: 'template:update',
  DELETE_TEMPLATE: 'template:delete',
  
  // User management
  MANAGE_USERS: 'users:manage',
  READ_USERS: 'users:read',
  
  // Audit permissions
  READ_AUDIT: 'audit:read',
  EXPORT_AUDIT: 'audit:export',
  
  // System permissions
  MANAGE_SYSTEM: 'system:manage',
  READ_SYSTEM: 'system:read',
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH_LOGIN: '/api/auth/login',
  AUTH_REGISTER: '/api/auth/register',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_ME: '/api/auth/me',
  AUTH_REFRESH: '/api/auth/refresh',
  
  // Workflows
  WORKFLOWS: '/api/workflows',
  WORKFLOW_INSTANCES: '/api/workflow-instances',
  
  // Users
  USERS: '/api/users',
  
  // Audit
  AUDIT: '/api/audit',
  
  // Casper
  CASPER_BALANCE: '/api/casper/balance',
  CASPER_DEPLOY: '/api/casper/deploy',
  
  // Health
  HEALTH: '/api/health',
} as const;

// Casper Network
export const CASPER_CONFIG = {
  TESTNET_RPC: 'https://testnet.cspr.live/rpc',
  MAINNET_RPC: 'https://mainnet.cspr.live/rpc',
  CHAIN_NAME_TESTNET: 'casper-test',
  CHAIN_NAME_MAINNET: 'casper',
  EXPLORER_TESTNET: 'https://testnet.cspr.live',
  EXPLORER_MAINNET: 'https://cspr.live',
  MOTES_PER_CSPR: BigInt('1000000000'),
} as const;

// Default payment amounts (in motes)
export const DEPLOY_COSTS = {
  CREATE_WORKFLOW: BigInt('5000000000'), // 5 CSPR
  TRANSITION_STATE: BigInt('3000000000'), // 3 CSPR
  MINIMUM_BALANCE: BigInt('10000000000'), // 10 CSPR recommended minimum
} as const;

// Time constants
export const TIME = {
  MINUTE_MS: 60 * 1000,
  HOUR_MS: 60 * 60 * 1000,
  DAY_MS: 24 * 60 * 60 * 1000,
  DEPLOY_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  POLL_INTERVAL_MS: 5 * 1000, // 5 seconds
  SESSION_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// Status colors for UI
export const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-800',
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  escalated: 'bg-purple-100 text-purple-800',
  cancelled: 'bg-gray-100 text-gray-600',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
} as const;

// Form validation
export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  COMMENT_MAX_LENGTH: 1000,
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'cewce_auth_token',
  REFRESH_TOKEN: 'cewce_refresh_token',
  USER: 'cewce_user',
  THEME: 'cewce_theme',
  WALLET_CONNECTED: 'cewce_wallet_connected',
  SIDEBAR_COLLAPSED: 'cewce_sidebar_collapsed',
} as const;

// Error codes
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  WALLET_NOT_CONNECTED: 'WALLET_NOT_CONNECTED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  DEPLOY_FAILED: 'DEPLOY_FAILED',
  DEPLOY_TIMEOUT: 'DEPLOY_TIMEOUT',
} as const;

// Feature flags (can be overridden via environment)
export const FEATURES = {
  ENABLE_WALLET_CONNECT: true,
  ENABLE_NOTIFICATIONS: true,
  ENABLE_EXPORT: true,
  ENABLE_MULTI_SIG: false, // Coming soon
  ENABLE_DARK_MODE: true,
  ENABLE_ANALYTICS: import.meta.env.PROD,
} as const;
