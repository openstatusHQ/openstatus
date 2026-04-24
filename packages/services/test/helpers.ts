import { expect } from "bun:test";
import { db, eq, inArray } from "@openstatus/db";
import {
  notification,
  page,
  pageComponent,
  selectWorkspaceSchema,
  workspace as workspaceTable,
} from "@openstatus/db/src/schema";

import type { AuditLogRecord } from "../src/audit";
import { installTestAuditBuffer, uninstallTestAuditBuffer } from "../src/audit";
import type { Actor, ServiceContext } from "../src/context";
import type { Workspace } from "../src/types";

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
 * Install the audit buffer for the scope of a test. Returns the live buffer
 * plus a cleanup fn — use in beforeEach / afterEach or with { using } semantics.
 */
export function withAuditBuffer(): {
  buffer: AuditLogRecord[];
  reset: () => void;
} {
  const buffer = installTestAuditBuffer();
  return {
    buffer,
    reset: () => {
      uninstallTestAuditBuffer();
    },
  };
}

/**
 * Assert an audit row matching `match` was recorded during the test.
 * Requires an active audit buffer (installTestAuditBuffer / withAuditBuffer).
 * In v1 this scans the in-memory buffer; in v2 it will query the audit_log
 * table. Call sites do not change.
 */
export async function expectAuditRow(
  buffer: AuditLogRecord[],
  match: {
    action: string;
    entityType: string;
    entityId: string | number;
    actorType?: Actor["type"];
  },
): Promise<void> {
  const expectedEntityId = String(match.entityId);
  const hit = buffer.find(
    (row) =>
      row.action === match.action &&
      row.entityType === match.entityType &&
      row.entityId === expectedEntityId &&
      (match.actorType === undefined || row.actorType === match.actorType),
  );
  expect(
    hit,
    `expected audit row for ${match.action} on ${match.entityType}#${expectedEntityId}`,
  ).toBeDefined();
}
