import { eq } from "@openstatus/db";
import { db } from "@openstatus/db";
import { apiKey } from "@openstatus/db/src/schema";
import {
  generateApiKey as generateKey,
  hashApiKey,
  shouldUpdateLastUsed as checkShouldUpdateLastUsed,
} from "@openstatus/db/src/utils/api-key";

/**
 * Creates a new API key for a workspace
 * @param workspaceId - The workspace ID
 * @param createdById - The ID of the user creating the key
 * @param name - The name of the API key
 * @param description - Optional description for the key
 * @param expiresAt - Optional expiration date
 * @returns The full token (only shown once) and the created key details
 */
export async function createApiKey(
  workspaceId: number,
  createdById: number,
  name: string,
  description?: string,
  expiresAt?: Date,
): Promise<{ token: string; key: typeof apiKey.$inferSelect }> {
  const { token, prefix, hash } = generateKey();

  const [key] = await db
    .insert(apiKey)
    .values({
      name,
      description,
      prefix,
      hashedToken: hash,
      workspaceId,
      createdById,
      expiresAt,
    })
    .returning();

  if (!key) {
    throw new Error("Failed to create API key");
  }

  return { token, key };
}

/**
 * Verifies an API key token
 * @param token - The API key token to verify
 * @returns The API key details if valid, null otherwise
 */
export async function verifyApiKey(
  token: string,
): Promise<(typeof apiKey.$inferSelect) | null> {
  // Extract prefix from token
  const prefix = token.slice(0, 11); // "os_" + 8 chars = 11 total

  // Look up key by prefix
  const key = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.prefix, prefix))
    .get();

  if (!key) {
    return null;
  }

  // Verify hash
  const hash = hashApiKey(token);
  if (hash !== key.hashedToken) {
    return null;
  }

  // Check expiration
  if (key.expiresAt && key.expiresAt < new Date()) {
    return null;
  }

  return key;
}

/**
 * Revokes (deletes) an API key
 * @param id - The API key ID
 * @param workspaceId - The workspace ID for ownership verification
 * @returns True if successfully revoked, false otherwise
 */
export async function revokeApiKey(
  id: number,
  workspaceId: number,
): Promise<boolean> {
  // First, verify the key exists and belongs to the workspace
  const key = await db.select().from(apiKey).where(eq(apiKey.id, id)).get();

  if (!key || key.workspaceId !== workspaceId) {
    return false;
  }

  // Delete the key
  await db.delete(apiKey).where(eq(apiKey.id, id));

  return true;
}

/**
 * Gets all API keys for a workspace
 * @param workspaceId - The workspace ID
 * @returns Array of API keys for the workspace
 */
export async function getApiKeys(
  workspaceId: number,
): Promise<Array<typeof apiKey.$inferSelect>> {
  const keys = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.workspaceId, workspaceId))
    .all();

  return keys;
}

/**
 * Updates the lastUsedAt timestamp for an API key (with debouncing)
 * @param id - The API key ID
 * @param lastUsedAt - The current lastUsedAt value (or null)
 * @returns True if updated, false if skipped due to debounce
 */
export async function updateLastUsed(
  id: number,
  lastUsedAt: Date | null,
): Promise<boolean> {
  // Check if update is needed (5-minute debounce)
  if (!checkShouldUpdateLastUsed(lastUsedAt)) {
    return false;
  }

  await db
    .update(apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKey.id, id));

  return true;
}
