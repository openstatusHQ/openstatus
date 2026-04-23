import { expect } from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  selectWorkspaceSchema,
  workspace as workspaceTable,
} from "@openstatus/db/src/schema";

import type { AuditLogRecord } from "../src/audit";
import { installTestAuditBuffer, uninstallTestAuditBuffer } from "../src/audit";
import type { Actor, ServiceContext } from "../src/context";
import type { Workspace } from "../src/types";

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
