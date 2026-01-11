// =============================================================================
// Casper Deployer Keys Loader
// =============================================================================
// Loads Casper deployer keys from Base64-encoded environment variables
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
 * Reads Base64-encoded PEM keys from:
 * - CASPER_DEPLOYER_SECRET_KEY_BASE64 (or CASPER_SECRET_KEY_PEM for backwards compat)
 * - CASPER_DEPLOYER_PUBLIC_KEY_BASE64 (or CASPER_PUBLIC_KEY_PEM for backwards compat)
 * - CASPER_PUBLIC_KEY_HEX (optional, for public key hex)
 * 
 * Writes decoded keys to /tmp/casper/ directory.
 * 
 * @returns true if keys were loaded successfully, false otherwise
 */
export function initializeDeployerKeys(): boolean {
  // Check for new env var names first, then fall back to old names
  const secretKeyBase64 = process.env.CASPER_DEPLOYER_SECRET_KEY_BASE64 || process.env.CASPER_SECRET_KEY_PEM;
  const publicKeyBase64 = process.env.CASPER_DEPLOYER_PUBLIC_KEY_BASE64 || process.env.CASPER_PUBLIC_KEY_PEM;
  const publicKeyHex = process.env.CASPER_PUBLIC_KEY_HEX;

  // Check if keys are already present (e.g., from Docker volume mount)
  if (existsSync(SECRET_KEY_PATH) && existsSync(PUBLIC_KEY_PATH)) {
    console.log('[deployer-keys] Casper deployer keys already present at /tmp/casper/');
    return true;
  }

  // Check if we have the required environment variables
  if (!secretKeyBase64 || !publicKeyBase64) {
    console.warn('[deployer-keys] Casper deployer key environment variables not set.');
    console.warn('[deployer-keys] Set CASPER_DEPLOYER_SECRET_KEY_BASE64 and CASPER_DEPLOYER_PUBLIC_KEY_BASE64');
    console.warn('[deployer-keys] Server-side template registration will be unavailable.');
    return false;
  }

  try {
    // Create directory if it doesn't exist
    if (!existsSync(CASPER_KEY_DIR)) {
      mkdirSync(CASPER_KEY_DIR, { recursive: true });
      console.log(`[deployer-keys] Created directory: ${CASPER_KEY_DIR}`);
    }

    // Decode and write secret key
    const secretKeyPem = Buffer.from(secretKeyBase64, 'base64').toString('utf-8');
    writeFileSync(SECRET_KEY_PATH, secretKeyPem, { encoding: 'utf-8' });
    chmodSync(SECRET_KEY_PATH, 0o600); // Read/write for owner only
    console.log(`[deployer-keys] Written secret key to ${SECRET_KEY_PATH}`);

    // Decode and write public key
    const publicKeyPem = Buffer.from(publicKeyBase64, 'base64').toString('utf-8');
    writeFileSync(PUBLIC_KEY_PATH, publicKeyPem, { encoding: 'utf-8' });
    chmodSync(PUBLIC_KEY_PATH, 0o644); // Read for all, write for owner
    console.log(`[deployer-keys] Written public key to ${PUBLIC_KEY_PATH}`);

    // Write public key hex if available
    if (publicKeyHex) {
      writeFileSync(PUBLIC_KEY_HEX_PATH, publicKeyHex.trim(), { encoding: 'utf-8' });
      chmodSync(PUBLIC_KEY_HEX_PATH, 0o644);
      console.log(`[deployer-keys] Written public key hex to ${PUBLIC_KEY_HEX_PATH}`);
    }

    console.log('[deployer-keys] ✓ Casper deployer keys loaded successfully');
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
