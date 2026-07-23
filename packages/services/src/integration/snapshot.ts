import type { integration } from "@openstatus/db/src/schema";

// Drizzle's inferred row type — JSON columns surface as `unknown` here,
// vs the zod-derived `Integration` type which narrows them to `Json`.
// We keep the looser shape so this helper accepts whatever `tx.select()`
// or `.returning()` actually produces, including historical rows that
// pre-date the current zod schema.
type IntegrationRow = typeof integration.$inferSelect;

/**
 * Stable, irreversible fingerprint of a Slack bot credential. Lets the
 * audit log show that a token rotated without ever storing the token
 * itself. Keyed on `botToken` because that's the field that actually
 * rotates on reinstall; `botUserId` is folded in so a re-install with
 * a different bot also surfaces.
 *
 * Uses Web Crypto (`crypto.subtle.digest`) instead of `node:crypto` so
 * this module is Edge-safe — the dashboard's tRPC bundles
 * `deleteIntegration` (which transitively imports this file) and runs
 * it on Next.js Edge, where `node:*` imports break the build.
 */
async function fingerprintCredential(c: {
  botToken: string;
  botUserId: string;
}) {
  const data = new TextEncoder().encode(`${c.botUserId}:${c.botToken}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/**
 * Audit-safe view of an integration row. Strips `credential` (raw bot
 * token) and replaces it with a non-reversible fingerprint so token
 * rotations register in `changed_fields` even when nothing else
 * changes. Both `installSlackAgent` and `deleteIntegration` go through
 * this helper so create/update/delete audit rows have the same shape —
 * a viewer diffing successive rows can rely on `credentialFingerprint`
 * being present at every step.
 *
 * Async because the underlying digest is async on Edge runtime.
 */
export async function snapshotIntegration(row: IntegrationRow) {
  const { credential, ...rest } = row;
  const fingerprint =
    credential &&
    typeof credential === "object" &&
    "botToken" in credential &&
    typeof (credential as { botToken: unknown }).botToken === "string" &&
    "botUserId" in credential &&
    typeof (credential as { botUserId: unknown }).botUserId === "string"
      ? await fingerprintCredential(
          credential as { botToken: string; botUserId: string },
        )
      : null;
  return { ...rest, credentialFingerprint: fingerprint };
}
