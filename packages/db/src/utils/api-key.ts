import crypto from "crypto";

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
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return { token, prefix, hash };
}

/**
 * Hashes an API key token using SHA-256
 * @param token - The API key token to hash
 * @returns The SHA-256 hash of the token
 */
export function hashApiKey(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
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
