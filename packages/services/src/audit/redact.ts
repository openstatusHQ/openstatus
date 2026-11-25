// Credentials kept on the row itself, per audited entity type. `emitAudit`
// replaces them with a fingerprint, so a rotation still diffs.
const SECRET_FIELDS: Readonly<Record<string, readonly string[]>> = {
  page: ["password"],
  // Webhook URLs, routing and API keys live inside the provider config.
  notification: ["data"],
  page_subscriber: ["token", "webhookUrl"],
};

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

export async function redactSecrets<T extends Record<string, unknown>>(
  entityType: string,
  snapshot: T,
): Promise<T> {
  const fields = SECRET_FIELDS[entityType];
  if (!fields) return snapshot;
  const redacted: Record<string, unknown> = { ...snapshot };
  for (const field of fields) {
    const value = redacted[field];
    // An empty value is not a secret; keeping it shows "none set".
    if (value === undefined || value === null || value === "") continue;
    redacted[field] = await auditFingerprint(value);
  }
  return redacted as T;
}
