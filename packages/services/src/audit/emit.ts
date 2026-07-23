import { auditLog } from "@openstatus/db/src/schema";
import { type AuditEntry, auditEntrySchema } from "@openstatus/db/src/schema";

import {
  type DB,
  type ServiceContext,
  extractActorId,
  tryGetActorUserId,
} from "../context";

/** Keys excluded from the top-level diff — always churny, never informative. */
const DIFF_IGNORE = new Set(["updatedAt", "createdAt"]);

/**
 * Deep equality for audit snapshots. Order-independent for object keys,
 * order-sensitive for arrays. Dates compare by `.getTime()`.
 *
 * Hand-rolled on purpose — this package is consumed from the dashboard's
 * tRPC handlers, which run on the Next.js Edge runtime. Node built-ins
 * like `node:util` aren't available on Edge (surfaced as
 * `isDeepStrictEqual is not a function` via Turbopack). The local copy
 * covers the shapes we actually store in `before`/`after` (primitives,
 * arrays, plain objects, Dates) and keeps the services package Edge-safe.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) {
    return false;
  }
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;

  if (a instanceof Date || b instanceof Date) {
    return (
      a instanceof Date && b instanceof Date && a.getTime() === b.getTime()
    );
  }

  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);
  if (aIsArr !== bIsArr) return false;
  if (aIsArr && bIsArr) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bObj, k)) return false;
    if (!deepEqual(aObj[k], bObj[k])) return false;
  }
  return true;
}

/**
 * Shallow diff between two entity snapshots. Reports top-level keys that
 * differ. Nested JSON columns (headers, locales, configuration) report as
 * a single top-level key — the UI is responsible for deeper diffs.
 */
export function diffTopLevel(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (DIFF_IGNORE.has(k)) continue;
    const b = before[k];
    const a = after[k];
    // Treat `undefined` and `null` as absent so a nullable column reading
    // back as `null` from one source and `undefined` from another doesn't
    // register as a change.
    const bAbsent = b === undefined || b === null;
    const aAbsent = a === undefined || a === null;
    if (bAbsent && aAbsent) continue;
    if (bAbsent !== aAbsent) {
      changed.push(k);
      continue;
    }
    if (!deepEqual(b, a)) changed.push(k);
  }
  return changed;
}

/**
 * Write an audit row inside the caller's transaction. Fail-closed:
 * `auditEntrySchema.parse` throws a `ZodError` on invalid input,
 * propagating and rolling back the enclosing mutation.
 *
 * `changed_fields` is auto-computed when both `before` and `after` are
 * supplied. If either is missing (e.g. creates, deletes), the column is
 * `null`. An empty array means "both supplied, nothing changed" —
 * distinct from null.
 */
export async function emitAudit(
  tx: DB,
  ctx: ServiceContext,
  entry: AuditEntry,
): Promise<void> {
  const parsed = auditEntrySchema.parse(entry);

  const before = parsed.before;
  const after = parsed.after;
  const metadata = "metadata" in parsed ? parsed.metadata : undefined;

  const changedFields =
    before !== undefined && after !== undefined
      ? diffTopLevel(before, after)
      : null;

  // No-op update: caller passed both snapshots and nothing changed.
  // Skip the insert — an empty-diff row has no informational value
  // (the action name alone doesn't tell us what the user tried to
  // change, and `before === after` duplicates the live entity state).
  // Exception: when `metadata` is present, the change lives outside
  // the row (e.g. component-scope edits on `page_subscriber` mutate
  // a join table, not the row itself). The metadata is the signal,
  // so the row still lands. Pure no-ops (no diff, no metadata) drop.
  if (
    changedFields !== null &&
    changedFields.length === 0 &&
    metadata === undefined
  ) {
    return;
  }

  const row = {
    workspaceId: ctx.workspace.id,
    actorType: ctx.actor.type,
    actorId: extractActorId(ctx.actor),
    actorUserId: tryGetActorUserId(ctx.actor),
    action: parsed.action,
    entityType: parsed.entityType,
    entityId: String(parsed.entityId),
    before: (before ?? null) as Record<string, unknown> | null,
    after: (after ?? null) as Record<string, unknown> | null,
    metadata: (metadata ?? null) as Record<string, unknown> | null,
    changedFields,
  };

  await tx.insert(auditLog).values(row);
}
