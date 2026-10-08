// oxlint-disable-next-line unicorn/prefer-node-protocol
import crypto from "node:crypto";

import bcrypt from "bcryptjs";

/**
 * Generates a new API key with token, prefix, and hash
 * @returns Object containing the full token, prefix for lookup, and SHA-256 hash
 */
export async function generateApiKey(): Promise<{
  token: string;
  prefix: string;
  hash: string;
}> {
  const randomBytes = crypto.randomBytes(16).toString("hex"); // 32 hex chars
  const token = `os_${randomBytes}`;
  const prefix = token.slice(0, 11); // "os_" (3 chars) + 8 hex chars = 11 total
  const hash = await bcrypt.hash(token, 10);
  return { token, prefix, hash };
}

/**
 * Hashes an API key token using bcrypt
 * @param token - The API key token to hash
 * @returns The bcrypt hash of the token
 */
export async function hashApiKey(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

/**
 * Verifies an API key token against a stored hash
 * Supports both bcrypt hashes (new) and SHA-256 hashes (legacy) for migration
 * @param token - The API key token to verify
 * @param storedHash - The stored hash to verify against
 * @returns True if the token matches the hash
 */
export async function verifyApiKeyHash(
  token: string,
  storedHash: string,
): Promise<boolean> {
  // Check if it's a bcrypt hash (starts with $2a$, $2b$, or $2y$)
  if (storedHash.startsWith("$2")) {
    return bcrypt.compare(token, storedHash);
  }

  // Unknown hash format
  return false;
}

/**
 * Determines if lastUsedAt should be updated based on debounce period
 * @param lastUsedAt - The last time the key was used (or null)
 * @param debounceMinutes - Minutes to wait before updating again (default: 5)
 * @param now - Reference time (default: wall clock); callers with an injected clock pass theirs
 * @returns True if lastUsedAt should be updated
 */
export function shouldUpdateLastUsed(
  lastUsedAt: Date | null,
  debounceMinutes = 5,
  now: Date = new Date(),
): boolean {
  if (!lastUsedAt) return true;
  const diffMs = now.getTime() - lastUsedAt.getTime();
  return diffMs > debounceMinutes * 60 * 1000;
}
