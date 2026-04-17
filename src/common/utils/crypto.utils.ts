import { createHash, randomBytes } from 'crypto';

/**
 * Generate a Token for OCPI.
 * 32 Bytes => 64 Hex-Chars
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Hashes a Token with SHA-256.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
