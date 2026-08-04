import { SQLiteTransaction, db as defaultDb, is } from "@openstatus/db";
import type { Scope, Workspace } from "@openstatus/db/src/schema";
import { OSTinybird } from "@openstatus/tinybird";

import { withBusyRetry } from "./retry";
import type { WorkOSClient } from "./sso/client";

// `@openstatus/db` does not export named DrizzleClient / DrizzleTx types today,
// so we derive them from the db export and re-export from here.
export type DrizzleClient = typeof defaultDb;
export type DrizzleTx = Parameters<
  Parameters<DrizzleClient["transaction"]>[0]
>[0];
export type DB = DrizzleClient | DrizzleTx;

export type Actor =
  | { type: "user"; userId: number }
  | { type: "apiKey"; keyId: string; userId?: number; scopes: Scope[] }
  | { type: "mcp"; keyId: string; userId?: number; scopes: Scope[] }
  | { type: "slack"; teamId: string; slackUserId: string; userId?: number }
  | { type: "system"; job: string }
  | { type: "webhook"; source: string; externalId?: string }
  | { type: "subscriber"; subscriberId: number };

export type ServiceContext = {
  workspace: Workspace;
  actor: Actor;
  requestId?: string;
  span?: unknown;
  db?: DB;
  tb?: OSTinybird;
  workos?: WorkOSClient;
};

// Fallback for callers with no app env to read from (scripts, tests). Request
// paths must inject their app's configured client via `ctx.tb` — this one has
// no validated env behind it.
export const defaultTb = new OSTinybird({
  token: process.env.TINY_BIRD_API_KEY ?? "",
  baseUrl: process.env.TINYBIRD_URL,
  noop: process.env.TINYBIRD_NOOP,
});

// drizzle's `is()` helper is identity-safe across module copies (uses a
// symbol-based entityKind), which `instanceof` is not under pnpm when multiple
// resolution paths exist.
export function isTx(db: DB): db is DrizzleTx {
  return is(db, SQLiteTransaction);
}

export async function withTransaction<T>(
  ctx: ServiceContext,
  fn: (tx: DB) => Promise<T>,
): Promise<T> {
  const db = ctx.db ?? defaultDb;
  if (isTx(db)) return fn(db);
  return withBusyRetry(() => (db as DrizzleClient).transaction(fn));
}

/**
 * Read-side DB resolver for list / get verbs. Use the caller's tx if one
 * was threaded through `ctx.db` (so reads observe in-flight writes), else
 * fall back to the default client. Equivalent to the inlined
 * `ctx.db ?? defaultDb` pattern, kept as a helper so service files don't
 * import `defaultDb` just to write the same expression.
 */
export function getReadDb(ctx: ServiceContext): DB {
  return ctx.db ?? defaultDb;
}

type BatchItemLike = Parameters<DrizzleClient["batch"]>[0][number];

type BatchResults<T extends readonly unknown[]> = {
  -readonly [K in keyof T]: Awaited<T[K]>;
};

/**
 * Run independent reads as one libsql round-trip instead of one HTTP
 * request per statement. Every query must be independent — the driver
 * sends them together, so none can consume another's result.
 *
 * Inside an interactive transaction there is no batch endpoint (the
 * session is baton-chained), so it degrades to `Promise.all`.
 *
 * Both casts are shape-preserving: drizzle types `batch()` as returning
 * `Awaited<T[K]>` per element, which is exactly what `Promise.all` on the
 * same thenables yields, but neither branch unifies with the generic
 * mapped type without help.
 */
export async function batchReads<
  T extends readonly [BatchItemLike, ...BatchItemLike[]],
>(db: DB, queries: T): Promise<BatchResults<T>> {
  if (isTx(db)) {
    return (await Promise.all(queries)) as BatchResults<T>;
  }
  return (await (db as DrizzleClient).batch(queries)) as BatchResults<T>;
}

export function extractActorId(actor: Actor): string {
  switch (actor.type) {
    case "user":
      return String(actor.userId);
    case "apiKey":
    case "mcp":
      return actor.keyId;
    case "slack":
      return actor.slackUserId;
    case "system":
      return actor.job;
    case "webhook":
      return actor.externalId ?? actor.source;
    case "subscriber":
      return String(actor.subscriberId);
  }
}

/**
 * Return the openstatus `user.id` attributable to this actor, or `null`
 * when none is available. Used by mutations that stamp a `*_by` column.
 * `slack` and `apiKey` actors may carry an optional linked userId once
 * the corresponding mapping layers exist.
 */
export function tryGetActorUserId(actor: Actor): number | null {
  switch (actor.type) {
    case "user":
      return actor.userId;
    case "apiKey":
    case "mcp":
    case "slack":
      return actor.userId ?? null;
    case "system":
    case "webhook":
    case "subscriber":
      return null;
  }
}
