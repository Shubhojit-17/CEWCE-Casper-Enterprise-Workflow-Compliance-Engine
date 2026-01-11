// =============================================================================
// Utility Functions
// =============================================================================

import { clsx, type ClassValue } from 'clsx';

/**
 * Combine class names with clsx
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Format a date string to a human-readable format
 */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(d);
}

/**
 * Format a date string with time
 */
export function formatDateTime(date: string | Date): string {
  return formatDate(date, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return formatDate(d);
  } else if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  } else if (hours > 0) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  } else {
    return 'Just now';
  }
}

/**
 * Truncate a string with ellipsis
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

/**
 * Truncate a hash or address for display
 */
export function truncateHash(hash: string, start = 8, end = 6): string {
  if (hash.length <= start + end) return hash;
  return `${hash.slice(0, start)}...${hash.slice(-end)}`;
}

/**
 * Format CSPR amount
 */
export function formatCspr(motes: string | bigint): string {
  const value = typeof motes === 'string' ? BigInt(motes) : motes;
  const cspr = value / BigInt(1_000_000_000);
  return `${cspr.toLocaleString()} CSPR`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a random string
 */
export function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Get status badge color
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'badge-neutral',
    PENDING: 'badge-info',
    ONCHAIN_PENDING: 'badge-info',
    COMPLETED: 'badge-success',
    CANCELLED: 'badge-danger',
    ESCALATED: 'badge-warning',
    CONFIRMED: 'badge-success',
    CONFIRMED_ONCHAIN: 'badge-success',
    FAILED: 'badge-danger',
    FAILED_ONCHAIN: 'badge-danger',
    TIMEOUT: 'badge-warning',
  };
  return colors[status] || 'badge-neutral';
}

/**
 * Get workflow state color
 */
export function getStateColor(stateId: number): string {
  // Based on contract state constants
  const colors: Record<number, string> = {
    0: 'bg-gray-100 text-gray-800', // DRAFT
    1: 'bg-blue-100 text-blue-800', // PENDING_REVIEW
    10: 'bg-green-100 text-green-800', // APPROVED
    11: 'bg-red-100 text-red-800', // REJECTED
    20: 'bg-yellow-100 text-yellow-800', // ESCALATED
    30: 'bg-gray-100 text-gray-800', // CANCELLED
  };
  return colors[stateId] || 'bg-gray-100 text-gray-800';
}

/**
 * Get workflow state name
 */
export function getStateName(stateId: number): string {
  const names: Record<number, string> = {
    0: 'Draft',
    1: 'Pending Review',
    10: 'Approved',
    11: 'Rejected',
    20: 'Escalated',
    30: 'Cancelled',
  };
  return names[stateId] || `State ${stateId}`;
}

// =============================================================================
// Casper Explorer URLs (RPC-Only Mode)
// =============================================================================

const CASPER_EXPLORER_URL = import.meta.env.VITE_CASPER_EXPLORER_URL || 'https://testnet.cspr.live';

/**
 * Get Casper Explorer URL for a deploy hash
 */
export function getDeployExplorerUrl(deployHash: string): string {
  return `${CASPER_EXPLORER_URL}/deploy/${deployHash}`;
}

/**
 * Get Casper Explorer URL for an account
 */
export function getAccountExplorerUrl(accountHash: string): string {
  return `${CASPER_EXPLORER_URL}/account/${accountHash}`;
}

/**
 * Get Casper Explorer URL for a block
 */
export function getBlockExplorerUrl(blockHash: string): string {
  return `${CASPER_EXPLORER_URL}/block/${blockHash}`;
}

/**
 * Get transaction status display text
 * Distinguishes: submitted, pending confirmation, finalized, failed
 */
export function getTransactionStatusText(status: string): { text: string; description: string } {
  const statuses: Record<string, { text: string; description: string }> = {
    SUBMITTED: {
      text: 'Submitted',
      description: 'Transaction submitted to network, awaiting inclusion in block',
    },
    PENDING: {
      text: 'Pending Confirmation',
      description: 'Included in block, awaiting finality confirmation via RPC polling',
    },
    CONFIRMED: {
      text: 'Finalized',
      description: 'Transaction finalized on-chain, verifiable via Casper Explorer',
    },
    FAILED: {
      text: 'Failed',
      description: 'Transaction execution failed on-chain',
    },
    TIMEOUT: {
      text: 'Confirmation Timeout',
      description: 'Confirmation polling timed out, verify status in Casper Explorer',
    },
  };
  return statuses[status] || { text: status, description: 'Unknown status' };
}
