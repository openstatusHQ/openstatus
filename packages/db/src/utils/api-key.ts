// biome-ignore lint/style/useNodejsImportProtocol: <explanation>
import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * Generates a new API key with token, prefix, and hash
 * @returns Object containing the full token, prefix for lookup, and SHA-256 hash
 */
export function generateApiKey(): {
  token: string;
  prefix: string;
  hash: string;
} {
  const randomBytes = crypto.randomBytes(16).toString("hex"); // 32 hex chars
  const token = `os_${randomBytes}`;
  const prefix = token.slice(0, 11); // "os_" (3 chars) + 8 hex chars = 11 total
  const hash = bcrypt.hashSync(token, 10);
  return { token, prefix, hash };
}

/**
 * Hashes an API key token using bcrypt
 * @param token - The API key token to hash
 * @returns The bcrypt hash of the token
 */
export function hashApiKey(token: string): string {
  return bcrypt.hashSync(token, 10);
}

/**
 * Verifies an API key token against a stored hash
 * Supports both bcrypt hashes (new) and SHA-256 hashes (legacy) for migration
 * @param token - The API key token to verify
 * @param storedHash - The stored hash to verify against
 * @returns True if the token matches the hash
 */
export function verifyApiKeyHash(token: string, storedHash: string): boolean {
  // Check if it's a bcrypt hash (starts with $2a$, $2b$, or $2y$)
  if (storedHash.startsWith("$2")) {
    return bcrypt.compareSync(token, storedHash);
  }

  // Unknown hash format
  return false;
}

/**
 * Determines if lastUsedAt should be updated based on debounce period
 * @param lastUsedAt - The last time the key was used (or null)
 * @param debounceMinutes - Minutes to wait before updating again (default: 5)
 * @returns True if lastUsedAt should be updated
 */
export function shouldUpdateLastUsed(
  lastUsedAt: Date | null,
  debounceMinutes = 5,
): boolean {
  if (!lastUsedAt) return true;
  const diffMs = Date.now() - lastUsedAt.getTime();
  return diffMs > debounceMinutes * 60 * 1000;
}
