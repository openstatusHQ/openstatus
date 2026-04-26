import { SQLiteTransaction, db as defaultDb, is } from "@openstatus/db";
import type { Workspace } from "@openstatus/db/src/schema";

// `@openstatus/db` does not export named DrizzleClient / DrizzleTx types today,
// so we derive them from the db export and re-export from here.
export type DrizzleClient = typeof defaultDb;
export type DrizzleTx = Parameters<
  Parameters<DrizzleClient["transaction"]>[0]
>[0];
export type DB = DrizzleClient | DrizzleTx;

export type Actor =
  | { type: "user"; userId: number }
  | { type: "apiKey"; keyId: string; userId?: number }
  | { type: "slack"; teamId: string; slackUserId: string; userId?: number }
  | { type: "system"; job: string }
  | { type: "webhook"; source: string; externalId?: string };

export type ServiceContext = {
  workspace: Workspace;
  actor: Actor;
  requestId?: string;
  span?: unknown;
  db?: DB;
};

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
  return (db as DrizzleClient).transaction(fn);
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

export function extractActorId(actor: Actor): string {
  switch (actor.type) {
    case "user":
      return String(actor.userId);
    case "apiKey":
      return actor.keyId;
    case "slack":
      return actor.slackUserId;
    case "system":
      return actor.job;
    case "webhook":
      return actor.externalId ?? actor.source;
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
    case "slack":
      return actor.userId ?? null;
    case "system":
    case "webhook":
      return null;
  }
}
