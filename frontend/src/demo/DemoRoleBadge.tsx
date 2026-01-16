// =============================================================================
// Demo Role Badge Component - TESTNET ONLY
// =============================================================================
// Displays the current demo role and "DEMO MODE" indicator.
// All demo code is isolated in src/demo/ and can be safely removed for mainnet.
// =============================================================================

import React from 'react';
import { BeakerIcon } from '@heroicons/react/24/outline';
import type { DemoRole } from './types';
import { getDemoRoleDisplayName } from './DemoRoleSwitcher';
import { DEMO_CONFIG } from './demoConfig';

interface DemoRoleBadgeProps {
  role: DemoRole | null;
  className?: string;
}

/**
 * DemoRoleBadge displays the current demo role in a persistent badge
 * that remains visible throughout the demo experience.
 */
export function DemoRoleBadge({ role, className = '' }: DemoRoleBadgeProps): React.ReactElement | null {
  if (!role) return null;

  const roleDisplay = getDemoRoleDisplayName(role);

  return (
    <div
      className={`fixed top-4 right-4 z-50 ${className}`}
      style={{ zIndex: DEMO_CONFIG.overlayZIndex - 1 }}
    >
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-red-500/20 to-amber-500/20 border border-red-500/30 backdrop-blur-md shadow-lg">
        {/* Pulsing demo indicator */}
        <div className="relative flex items-center justify-center">
          <span className="absolute inline-flex h-3 w-3 rounded-full bg-red-500 opacity-75 animate-ping" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
        </div>
        
        {/* Role text */}
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
            ROLE: {roleDisplay.toUpperCase()}
          </span>
          <span className="text-[10px] font-medium text-amber-400/80 uppercase tracking-wider">
            DEMO MODE • TESTNET
          </span>
        </div>

        {/* Beaker icon */}
        <BeakerIcon className="h-5 w-5 text-red-400 ml-1" />
      </div>
    </div>
  );
}

/**
 * Compact version of the badge for tighter spaces
 */
export function DemoRoleBadgeCompact({ role }: { role: DemoRole | null }): React.ReactElement | null {
  if (!role) return null;

  const roleDisplay = getDemoRoleDisplayName(role);

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
      </span>
      <span className="text-xs font-medium text-red-400">
        {roleDisplay} • Demo
      </span>
    </div>
  );
}

export default DemoRoleBadge;
