import { createHash } from "node:crypto";
import { integration } from "@openstatus/db/src/schema";

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
 */
function fingerprintCredential(c: { botToken: string; botUserId: string }) {
  return createHash("sha256")
    .update(`${c.botUserId}:${c.botToken}`)
    .digest("hex")
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
 */
export function snapshotIntegration(row: IntegrationRow) {
  const { credential, ...rest } = row;
  const fingerprint =
    credential &&
    typeof credential === "object" &&
    "botToken" in credential &&
    typeof (credential as { botToken: unknown }).botToken === "string" &&
    "botUserId" in credential &&
    typeof (credential as { botUserId: unknown }).botUserId === "string"
      ? fingerprintCredential(
          credential as { botToken: string; botUserId: string },
        )
      : null;
  return { ...rest, credentialFingerprint: fingerprint };
}
