import type { AuditEntityType } from "@openstatus/db/src/schema";

// Credentials kept on the row itself, per audited entity type. `emitAudit`
// diffs the raw snapshots, then stores this marker in their place: a
// rotation still lands in `changed_fields`, and nothing derived from the
// secret (a page password can be guessed from its hash) reaches the row.
const SECRET_FIELDS: Partial<Record<AuditEntityType, readonly string[]>> = {
  page: ["password"],
  // Webhook URLs, routing and API keys live inside the provider config.
  notification: ["data"],
  page_subscriber: ["token", "webhookUrl"],
};

export const REDACTED = "[redacted]";

/** First 16 hex chars of the SHA-256; Web Crypto keeps this Edge-safe. */
export async function auditFingerprint(value: unknown): Promise<string> {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex.slice(0, 16)}`;
}

export function redactSecrets<T extends Record<string, unknown>>(
  entityType: AuditEntityType,
  snapshot: T,
): T {
  const fields = SECRET_FIELDS[entityType];
  if (!fields) return snapshot;
  const redacted: Record<string, unknown> = { ...snapshot };
  for (const field of fields) {
    const value = redacted[field];
    // An empty value is not a secret; keeping it shows "none set".
    if (value === undefined || value === null || value === "") continue;
    redacted[field] = REDACTED;
  }
  return redacted as T;
}
