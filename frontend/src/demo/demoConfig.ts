// =============================================================================
// Demo Mode Configuration - TESTNET ONLY
// =============================================================================
// This file contains configuration for the demo system.
// All demo code is isolated in src/demo/ and can be safely removed for mainnet.
// =============================================================================

import type { DemoAccountConfig } from './types';

/**
 * CRITICAL: Demo mode is controlled by this build-time environment variable.
 * This is set in the hosting platform (Railway, Vercel, etc.) and requires
 * a redeploy to change. It is NEVER modified at runtime.
 * 
 * When false:
 * - No demo button appears
 * - No demo popup renders
 * - Demo code is unreachable
 * 
 * When true:
 * - Demo button appears on login page
 * - Demo flow is available
 * - Still requires user action to start
 */
export const DEMO_ENABLED = import.meta.env.VITE_DEMO_MODE === 'true';

/**
 * localStorage key for demo state persistence
 */
export const DEMO_STATE_KEY = 'cewce_demo_active';

/**
 * localStorage key for full demo state
 */
export const DEMO_FULL_STATE_KEY = 'cewce_demo_state';

/**
 * Demo account display information
 * NOTE: Credentials are NEVER stored here or exposed to the UI.
 * Demo authentication is handled via secure demo tokens on the backend.
 */
export const DEMO_ACCOUNTS: DemoAccountConfig[] = [
  {
    role: 'requester',
    displayName: 'Demo Requester',
    description: 'Creates and submits workflow requests for compliance review',
  },
  {
    role: 'user',
    displayName: 'Demo Customer (User1)',
    description: 'Reviews and confirms assigned workflow requests',
  },
  {
    role: 'approver',
    displayName: 'Demo Approver',
    description: 'Reviews workflows and records decisions on-chain',
  },
];

/**
 * Demo configuration constants
 */
export const DEMO_CONFIG = {
  /** Estimated total demo time */
  estimatedTime: '3-5 minutes',
  
  /** Delay before auto-login actions (ms) */
  autoLoginDelay: 1500,
  
  /** Delay before navigation actions (ms) */
  navigationDelay: 800,
  
  /** Z-index for demo overlay */
  overlayZIndex: 9999,
  
  /** Z-index for demo highlight */
  highlightZIndex: 9998,
  
  /** Testnet explorer URL */
  explorerUrl: 'https://testnet.cspr.live',
};

/**
 * Check if demo mode should be available
 * This is the single source of truth for demo availability
 */
export function isDemoAvailable(): boolean {
  return DEMO_ENABLED;
}
