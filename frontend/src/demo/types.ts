// =============================================================================
// Demo Mode Types - TESTNET ONLY
// =============================================================================
// This module defines TypeScript types for the demo system.
// All demo code is isolated in src/demo/ and can be safely removed for mainnet.
// =============================================================================

/**
 * Demo roles that users will experience during the guided flow
 */
export type DemoRole = 'requester' | 'user' | 'approver';

/**
 * Demo step identifiers - enforces linear progression
 */
export type DemoStepId =
  | 'orientation'
  | 'requester-login'
  | 'requester-navigate-workflows'
  | 'requester-create-workflow'
  | 'requester-assign-customer'
  | 'requester-to-user-transition'
  | 'user-login'
  | 'user-view-inbox'
  | 'user-accept-workflow'
  | 'user-to-approver-transition'
  | 'approver-login'
  | 'approver-review-workflow'
  | 'approver-action'
  | 'onchain-proof'
  | 'demo-complete';

/**
 * Demo step definition
 */
export interface DemoStep {
  id: DemoStepId;
  role: DemoRole | null; // null for orientation and completion
  title: string;
  description: string;
  instruction?: string;
  targetSelector?: string; // CSS selector for element to highlight
  targetPath?: string; // Route path user should be on
  action?: 'auto-login' | 'auto-logout' | 'navigate' | 'wait-for-action' | 'complete';
  nextButtonText?: string;
  showSkip?: boolean;
  estimatedTime?: string;
}

/**
 * Demo state stored in context and localStorage
 */
export interface DemoState {
  isActive: boolean;
  currentStepIndex: number;
  currentRole: DemoRole | null;
  workflowId: string | null; // Track created workflow for continuity
  hasCompletedBefore: boolean;
  startedAt: string | null;
}

/**
 * Demo context value
 */
export interface DemoContextValue {
  // State
  state: DemoState;
  currentStep: DemoStep | null;
  
  // Actions
  startDemo: () => void;
  exitDemo: () => Promise<void>;
  nextStep: () => void;
  skipDemo: () => Promise<void>;
  setWorkflowId: (id: string) => void;
  
  // Computed
  isLastStep: boolean;
  progress: number; // 0-100
}

/**
 * Demo account configuration (credentials are NEVER exposed to UI)
 */
export interface DemoAccountConfig {
  role: DemoRole;
  displayName: string;
  description: string;
  // Note: Actual credentials are handled server-side via demo tokens
}
