// =============================================================================
// Demo Module Exports - TESTNET ONLY
// =============================================================================
// Single entry point for all demo-related exports.
// All demo code is isolated in src/demo/ and can be safely removed for mainnet.
//
// REMOVAL GUARANTEE:
// Before mainnet deployment:
// 1. Set VITE_DEMO_MODE=false in environment
// 2. Optionally delete this entire src/demo/ directory
// 3. The application will still build and work with zero demo references
// =============================================================================

// Configuration
export { DEMO_ENABLED, DEMO_STATE_KEY, DEMO_CONFIG, isDemoAvailable } from './demoConfig';

// Types
export type { 
  DemoRole, 
  DemoStepId, 
  DemoStep, 
  DemoState, 
  DemoContextValue 
} from './types';

// Provider
export { 
  DemoProvider, 
  ConditionalDemoProvider, 
  useDemoContext, 
  useRequiredDemoContext 
} from './DemoProvider';

// Story Sequences (new story-driven system)
export { 
  STORY_SEQUENCES, 
  TOTAL_SEQUENCES,
  getSequenceById, 
  getSequenceByLabel,
  getInitialSequence,
  getSequenceIndex,
  getNextSequence 
} from './StorySequences';
export type { StorySequence } from './StorySequences';

// Legacy Steps (kept for compatibility)
export { DEMO_STEPS, getStepById, getStepIndex, getNextStep, isTransitionStep } from './DemoSteps';

// Role switcher
export { 
  requestDemoAuth, 
  demoLogout, 
  switchDemoRole, 
  getDemoRoleDisplayName, 
  getDemoRoleDescription 
} from './DemoRoleSwitcher';

// Components
export { DemoOverlay } from './DemoOverlay';
export { DemoHighlight } from './DemoHighlight';
export { DemoRoleBadge, DemoRoleBadgeCompact } from './DemoRoleBadge';
export { NarrativeBox } from './NarrativeBox';
export { DemoPage } from './DemoPage';
