import { expect } from "bun:test";
import { and, db, desc, eq, inArray } from "@openstatus/db";
import {
  auditLog,
  notification,
  page,
  pageComponent,
  selectWorkspaceSchema,
  workspace as workspaceTable,
} from "@openstatus/db/src/schema";

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

/**
 * Clear leftover quota-gated rows on a workspace so tests that rely on
 * a specific cap state (e.g. `free` plan has `status-pages: 1`,
 * `notification-channels: 1`) can run regardless of what prior tests
 * or aborted runs left behind.
 *
 * Intended for `beforeAll` of suites that exercise the `free`
 * workspace — the tight-plan negative tests break randomly otherwise
 * because cumulative state trips a quota check before the test can
 * hit its intended assertion. Scoped to the two tables that have bit
 * us repeatedly in CI; extend when a new quota-gated table surfaces.
 */
export async function cleanQuotaGatedTables(
  workspaceId: number,
): Promise<void> {
  // Pages → delete dependent pageComponents first to satisfy FKs.
  const pages = await db
    .select({ id: page.id })
    .from(page)
    .where(eq(page.workspaceId, workspaceId))
    .all();
  const pageIds = pages.map((p) => p.id);
  if (pageIds.length > 0) {
    await db
      .delete(pageComponent)
      .where(inArray(pageComponent.pageId, pageIds))
      .catch(() => undefined);
    await db
      .delete(page)
      .where(inArray(page.id, pageIds))
      .catch(() => undefined);
  }
  await db
    .delete(notification)
    .where(eq(notification.workspaceId, workspaceId))
    .catch(() => undefined);
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
 * Load a seeded workspace by id (defaults to id=1, the `team` plan fixture).
 * Tests that need a fresh workspace should insert one explicitly and clean up;
 * isolating every test with its own workspace is the prevailing convention.
 */
export async function loadSeededWorkspace(id = 1): Promise<Workspace> {
  const row = await db
    .select()
    .from(workspaceTable)
    .where(eq(workspaceTable.id, id))
    .get();
  if (!row) {
    throw new Error(
      `loadSeededWorkspace(${id}): workspace not found. Did you seed the db?`,
    );
  }
  return selectWorkspaceSchema.parse(row);
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
  opts: { keyId: string; userId?: number; requestId?: string },
): ServiceContext {
  return {
    workspace,
    actor: {
      type: "apiKey",
      keyId: opts.keyId,
      userId: opts.userId,
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
  expect(
    hit,
    `expected audit row for ${match.action} on ${match.entityType}#${expectedEntityId}`,
  ).toBeDefined();
}
