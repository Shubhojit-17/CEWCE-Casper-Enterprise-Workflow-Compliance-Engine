// =============================================================================
// Demo Role Switcher - TESTNET ONLY
// =============================================================================
// Handles automatic login/logout for demo role transitions.
// Credentials are NEVER exposed - authentication uses secure demo tokens.
// All demo code is isolated in src/demo/ and can be safely removed for mainnet.
// =============================================================================

import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import type { DemoRole } from './types';
import { DEMO_CONFIG } from './demoConfig';

/**
 * Demo authentication response from backend
 * The backend handles credential lookup securely
 */
interface DemoAuthResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      publicKey: string | null;
      accountHash: string | null;
      avatar: string | null;
      isActive: boolean;
      emailVerified: boolean;
      createdAt: string;
      updatedAt: string;
      lastLoginAt: string | null;
      roles?: string[];
    };
    token: string;
  };
}

/**
 * Request demo authentication for a specific role.
 * 
 * SECURITY: This endpoint exists only on testnet and:
 * - Does not expose credentials
 * - Uses pre-configured demo accounts
 * - Returns a real JWT token
 * - Requires DEMO_MODE to be enabled on backend
 */
export async function requestDemoAuth(role: DemoRole): Promise<void> {
  try {
    // Use the demo auth endpoint - credentials are handled server-side
    const response = await api.post<DemoAuthResponse>('/auth/demo', {
      role,
    });

    const { user, token } = response.data.data;

    // Set auth header for future requests
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Update auth store directly (same as regular login)
    useAuthStore.setState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  } catch (error) {
    console.error('Demo auth failed:', error);
    throw new Error(`Failed to authenticate as demo ${role}. Please ensure demo mode is enabled on the server.`);
  }
}

/**
 * Logout from demo account
 */
export async function demoLogout(): Promise<void> {
  useAuthStore.getState().logout();
  
  // Small delay to ensure state is cleared
  await new Promise(resolve => setTimeout(resolve, 200));
}

/**
 * Switch from current demo role to a new role
 * Handles the full logout → login transition
 */
export async function switchDemoRole(newRole: DemoRole): Promise<void> {
  // First logout
  await demoLogout();
  
  // Wait for UI to update
  await new Promise(resolve => setTimeout(resolve, DEMO_CONFIG.autoLoginDelay));
  
  // Then login as new role
  await requestDemoAuth(newRole);
}

/**
 * Get display name for a demo role
 */
export function getDemoRoleDisplayName(role: DemoRole): string {
  switch (role) {
    case 'requester':
      return 'Requester';
    case 'user':
      return 'Customer (User1)';
    case 'approver':
      return 'Approver';
    default:
      return role;
  }
}

/**
 * Get role description
 */
export function getDemoRoleDescription(role: DemoRole): string {
  switch (role) {
    case 'requester':
      return 'Creates and submits workflow requests';
    case 'user':
      return 'Reviews and confirms assigned workflows';
    case 'approver':
      return 'Approves or rejects with on-chain recording';
    default:
      return '';
  }
}
