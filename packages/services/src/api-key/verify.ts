import { db as defaultDb, eq } from "@openstatus/db";
import { apiKey } from "@openstatus/db/src/schema";
import {
  shouldUpdateLastUsed as checkShouldUpdateLastUsed,
  verifyApiKeyHash,
} from "@openstatus/db/src/utils/api-key";

import type { ServiceContext } from "../context";
import type { ApiKey } from "../types";
import { UpdateApiKeyLastUsedInput, VerifyApiKeyInput } from "./schemas";

/**
 * Verify a plaintext token. Returns the stored key row when the token is
 * well-formed, resolves to an existing row, matches the stored bcrypt
 * hash, and isn't expired. Returns `null` otherwise.
 *
 * Does *not* take a `ServiceContext` because verification runs *before*
 * the caller's workspace is known — this is the resolution step that
 * derives the workspace from the token. Explicit `db` override is
 * supported for tests that need a pre-opened transaction.
 */
export async function verifyApiKey(
  input: VerifyApiKeyInput,
  opts: { db?: ServiceContext["db"] } = {},
): Promise<ApiKey | null> {
  const parsed = VerifyApiKeyInput.parse(input);
  const db = opts.db ?? defaultDb;

  // Token format check avoids hitting the DB for obviously-malformed input.
  if (!/^os_[a-f0-9]{32}$/.test(parsed.token)) return null;

  // "os_" (3) + 8 hex chars = 11-char prefix stored alongside the hash.
  const prefix = parsed.token.slice(0, 11);

  const key = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.prefix, prefix))
    .get();

  if (!key) return null;
  if (!(await verifyApiKeyHash(parsed.token, key.hashedToken))) return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;

  return key as ApiKey;
}

/**
 * Bump `lastUsedAt` to now, debounced by the shared `shouldUpdateLastUsed`
 * helper (5 minutes). Returns `true` when the row was written, `false`
 * when skipped. No ctx required — called from the request auth path
 * which runs before workspace resolution.
 */
export async function updateApiKeyLastUsed(
  input: UpdateApiKeyLastUsedInput,
  opts: { db?: ServiceContext["db"] } = {},
): Promise<boolean> {
  const parsed = UpdateApiKeyLastUsedInput.parse(input);
  const db = opts.db ?? defaultDb;

  if (!checkShouldUpdateLastUsed(parsed.lastUsedAt)) return false;

  await db
    .update(apiKey)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKey.id, parsed.id));

  return true;
}
