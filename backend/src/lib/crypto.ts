// =============================================================================
// Cryptographic Utilities
// =============================================================================

import { createHash, randomBytes } from 'crypto';

/**
 * Generate a SHA-256 hash of the input data.
 */
export function sha256(data: string | Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

/**
 * Generate a SHA-256 hash and return as hex string.
 */
export function sha256Hex(data: string | Buffer): string {
  return sha256(data).toString('hex');
}

/**
 * Generate a SHA-256 hash and return as Uint8Array (32 bytes).
 */
export function sha256Bytes(data: string | Buffer): Uint8Array {
  return new Uint8Array(sha256(data));
}

/**
 * Generate random bytes.
 */
export function generateRandomBytes(length: number): Buffer {
  return randomBytes(length);
}

/**
 * Generate a random hex string.
 */
export function generateRandomHex(length: number): string {
  return randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

/**
 * Convert a hex string to Uint8Array.
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
