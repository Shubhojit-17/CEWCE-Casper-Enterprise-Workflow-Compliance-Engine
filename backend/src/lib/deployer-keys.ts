// =============================================================================
// Casper Deployer Keys Loader
// =============================================================================
// Loads Casper deployer keys from environment variables (plain PEM format)
// and writes them to /tmp/casper/ for the Casper SDK to use.
// 
// This runs ONCE at application startup, BEFORE any Casper SDK code.
// =============================================================================

import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'fs';

// Key file paths (must match casper.ts expectations)
const CASPER_KEY_DIR = '/tmp/casper';
const SECRET_KEY_PATH = `${CASPER_KEY_DIR}/secret_key.pem`;
const PUBLIC_KEY_PATH = `${CASPER_KEY_DIR}/public_key.pem`;
const PUBLIC_KEY_HEX_PATH = `${CASPER_KEY_DIR}/public_key_hex`;

/**
 * Initialize Casper deployer keys from environment variables.
 * 
 * Reads plain PEM keys from:
 * - CASPER_SECRET_KEY_PEM (raw PEM content)
 * - CASPER_PUBLIC_KEY_PEM (raw PEM content)
 * - CASPER_PUBLIC_KEY_HEX (optional, for public key hex)
 * 
 * Writes keys to /tmp/casper/ directory.
 * 
 * @returns true if keys were loaded successfully, false otherwise
 */
export function initializeDeployerKeys(): boolean {
  const secretKeyPem = process.env.CASPER_SECRET_KEY_PEM;
  const publicKeyPem = process.env.CASPER_PUBLIC_KEY_PEM;
  const publicKeyHex = process.env.CASPER_PUBLIC_KEY_HEX;

  // Check if keys are already present (e.g., from Docker volume mount)
  if (existsSync(SECRET_KEY_PATH) && existsSync(PUBLIC_KEY_PATH)) {
    console.log('[deployer-keys] Casper deployer keys already present at /tmp/casper/');
    return true;
  }

  // Check if we have the required environment variables
  if (!secretKeyPem || !publicKeyPem) {
    console.warn('[deployer-keys] Casper deployer keys missing in environment');
    console.warn('[deployer-keys] Set CASPER_SECRET_KEY_PEM and CASPER_PUBLIC_KEY_PEM');
    console.warn('[deployer-keys] Server-side template registration will be unavailable.');
    return false;
  }

  try {
    // Create directory if it doesn't exist
    if (!existsSync(CASPER_KEY_DIR)) {
      mkdirSync(CASPER_KEY_DIR, { recursive: true });
    }

    // Write secret key (plain PEM, no decoding needed)
    writeFileSync(SECRET_KEY_PATH, secretKeyPem, { encoding: 'utf-8' });
    chmodSync(SECRET_KEY_PATH, 0o600); // Read/write for owner only

    // Write public key (plain PEM, no decoding needed)
    writeFileSync(PUBLIC_KEY_PATH, publicKeyPem, { encoding: 'utf-8' });
    chmodSync(PUBLIC_KEY_PATH, 0o644); // Read for all, write for owner

    // Write public key hex if available
    if (publicKeyHex) {
      writeFileSync(PUBLIC_KEY_HEX_PATH, publicKeyHex.trim(), { encoding: 'utf-8' });
      chmodSync(PUBLIC_KEY_HEX_PATH, 0o644);
    }

    console.log('[deployer-keys] Casper deployer keys written to /tmp/casper');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[deployer-keys] Failed to write deployer keys: ${errorMessage}`);
    console.warn('[deployer-keys] Server-side template registration will be unavailable.');
    return false;
  }
}

/**
 * Check if deployer keys are available on disk.
 */
export function areDeployerKeysAvailable(): boolean {
  return existsSync(SECRET_KEY_PATH) && existsSync(PUBLIC_KEY_PATH);
}
