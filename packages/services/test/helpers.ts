import { and, db, desc, eq, inArray } from "@openstatus/db";
import {
  type Scope,
  auditLog,
  selectWorkspaceSchema,
} from "@openstatus/db/src/schema";
import { createTestWorkspace } from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";

import type { Actor, DB, DrizzleTx, ServiceContext } from "../src/context";
import type { Workspace } from "../src/types";

class RollbackSignal extends Error {}

/**
 * Wrap a test body in a transaction that always rolls back, so per-test
 * writes (rows, audit log entries, etc.) never reach the committed db.
 *
 * Usage:
 *   await withTestTransaction(async (tx) => {
 *     const ctx = { ...makeUserCtx(workspace), db: tx };
 *     await createPage({ ctx, input });
 *     await expectAuditRow({ ..., db: tx });
 *   });
 *
 * Constraints:
 *   - Top-level test wrapper only. Don't call inside service code or
 *     nest two `withTestTransaction` calls — libsql HTTP doesn't
 *     support savepoints.
 *   - Inside the callback, replace any `db.select(...)` /
 *     `db.insert(...)` / `db.delete(...)` with the same call on `tx`.
 *     Reads via committed `db` will not see the in-tx writes.
 */
export async function withTestTransaction<T>(
  fn: (tx: DrizzleTx) => Promise<T>,
): Promise<T> {
  let result!: T;
  try {
    await db.transaction(async (tx) => {
      result = await fn(tx);
      throw new RollbackSignal();
    });
  } catch (e) {
    if (!(e instanceof RollbackSignal)) throw e;
  }
  return result;
}

/** Wipe audit_log rows for a workspace. Call in `beforeEach` / `afterEach`. */
export async function clearAuditLog(
  workspaceId: number,
  opts: { db?: DB } = {},
): Promise<void> {
  const conn = opts.db ?? db;
  await conn
    .delete(auditLog)
    .where(eq(auditLog.workspaceId, workspaceId))
    .catch(() => undefined);
}

/**
 * Delete audit_log rows for specific (entityType, entityId) pairs.
 *
 * Tests that create entities through services on the committed db and
 * then delete those entities in cleanup must also call this — otherwise
 * the audit row outlives the entity, and because SQLite recycles
 * INTEGER PRIMARY KEY ids after deletes, a later test's freshly-inserted
 * entity can land on the orphan's id and inherit its actor attribution.
 * See docs/adr/test-audit-cleanup.md.
 */
export async function clearAuditLogFor(args: {
  entityType: string;
  entityIds: ReadonlyArray<string | number>;
  db?: DB;
}): Promise<void> {
  if (args.entityIds.length === 0) return;
  const conn = args.db ?? db;
  await conn
    .delete(auditLog)
    .where(
      and(
        eq(auditLog.entityType, args.entityType),
        inArray(
          auditLog.entityId,
          args.entityIds.map((id) => String(id)),
        ),
      ),
    )
    .catch(() => undefined);
}

export type WorkspaceFixture = {
  workspace: Workspace;
  /** Owner of the workspace — pass to `makeUserCtx` for a member-of-workspace actor. */
  userId: number;
};

/**
 * A workspace owned by this suite alone, on the given plan.
 *
 * Call this in `beforeAll` instead of reaching for a seeded workspace. Suites
 * that share workspace 1 race each other over `audit_log`, plan quotas and
 * row counts once test files run in parallel — a private workspace makes those
 * assertions deterministic.
 *
 * `overrides` reaches the workspace row directly — pass `limits` to model a
 * purchased add-on, which is stored as an override on top of the plan defaults.
 */
export async function createWorkspaceFixture(
  plan: "team" | "free" | "scale" = "team",
  overrides: { limits?: string; ssoEnabled?: boolean } = {},
): Promise<WorkspaceFixture> {
  const { workspace, user } = await createTestWorkspace({ plan, ...overrides });
  return {
    workspace: selectWorkspaceSchema.parse(workspace),
    userId: user.id,
  };
}

export function makeUserCtx(
  workspace: Workspace,
  opts: { userId: number; requestId?: string } = { userId: 1 },
): ServiceContext {
  return {
    workspace,
    actor: { type: "user", userId: opts.userId },
    requestId: opts.requestId,
  };
}

export function makeApiKeyCtx(
  workspace: Workspace,
  opts: {
    keyId: string;
    userId?: number;
    requestId?: string;
    scopes?: Scope[];
  },
): ServiceContext {
  return {
    workspace,
    actor: {
      type: "apiKey",
      keyId: opts.keyId,
      userId: opts.userId,
      scopes: opts.scopes ?? ["write"],
    },
    requestId: opts.requestId,
  };
}

export function makeMcpCtx(
  workspace: Workspace,
  opts: {
    keyId: string;
    userId?: number;
    requestId?: string;
    scopes?: Scope[];
  },
): ServiceContext {
  return {
    workspace,
    actor: {
      type: "mcp",
      keyId: opts.keyId,
      userId: opts.userId,
      scopes: opts.scopes ?? ["write"],
    },
    requestId: opts.requestId,
  };
}

export function makeSlackCtx(
  workspace: Workspace,
  opts: {
    teamId: string;
    slackUserId: string;
    userId?: number;
    requestId?: string;
  },
): ServiceContext {
  return {
    workspace,
    actor: {
      type: "slack",
      teamId: opts.teamId,
      slackUserId: opts.slackUserId,
      userId: opts.userId,
    },
    requestId: opts.requestId,
  };
}

export function makeSystemCtx(
  workspace: Workspace,
  opts: { job: string; requestId?: string },
): ServiceContext {
  return {
    workspace,
    actor: { type: "system", job: opts.job },
    requestId: opts.requestId,
  };
}

/**
 * Read audit rows for a workspace, optionally filtered by entity.
 * Sort is `(id DESC)` — the autoincrement id is monotonic within the
 * test DB and gives deterministic order even for rows written in the
 * same millisecond.
 */
export async function readAuditLog(filter: {
  workspaceId: number;
  entityType?: string;
  entityId?: string | number;
  db?: DB;
}): Promise<(typeof auditLog.$inferSelect)[]> {
  const conn = filter.db ?? db;
  const clauses = [eq(auditLog.workspaceId, filter.workspaceId)];
  if (filter.entityType !== undefined) {
    clauses.push(eq(auditLog.entityType, filter.entityType));
  }
  if (filter.entityId !== undefined) {
    clauses.push(eq(auditLog.entityId, String(filter.entityId)));
  }
  return conn
    .select()
    .from(auditLog)
    .where(and(...clauses))
    .orderBy(desc(auditLog.id))
    .all();
}

/**
 * Assert an audit row matching `match` was recorded during the test.
 * Queries the real `audit_log` table — ensure tests clean rows per
 * workspace (see `clearAuditLog`) or rely on fresh entity ids to
 * avoid cross-test matches.
 */
export async function expectAuditRow(match: {
  workspaceId: number;
  action: string;
  entityType: string;
  entityId: string | number;
  actorType?: Actor["type"];
  db?: DB;
}): Promise<void> {
  const expectedEntityId = String(match.entityId);
  const rows = await readAuditLog({
    workspaceId: match.workspaceId,
    entityType: match.entityType,
    entityId: expectedEntityId,
    db: match.db,
  });
  const hit = rows.find(
    (row) =>
      row.action === match.action &&
      (match.actorType === undefined || row.actorType === match.actorType),
  );
  if (hit === undefined) {
    throw new Error(
      `expected audit row for ${match.action} on ${match.entityType}#${expectedEntityId}`,
    );
  }
  expect(hit).toBeDefined();
}
