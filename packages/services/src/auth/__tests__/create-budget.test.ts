import { db } from "@openstatus/db";
import { auditLog } from "@openstatus/db/src/schema";
import { beforeAll, describe, expect, test } from "vitest";

import {
  clearAuditLog,
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeMcpCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DB, ServiceContext } from "../../context";
import { PreconditionFailedError } from "../../errors";
import type { Workspace } from "../../types";
import { assertCreateBudget } from "../create-budget";

const KEY = "budget-key";

let workspace: Workspace;

beforeAll(async () => {
  workspace = (await createWorkspaceFixture("team")).workspace;
});

async function seedCreates(
  tx: DB,
  n: number,
  opts: { keyId?: string; action?: string; ageMs?: number } = {},
) {
  if (n === 0) return;
  await tx.insert(auditLog).values(
    Array.from({ length: n }, (_, i) => ({
      workspaceId: workspace.id,
      actorType: "mcp",
      actorId: opts.keyId ?? KEY,
      action: opts.action ?? "monitor.create",
      entityType: "monitor",
      entityId: String(i + 1),
      createdAt: new Date(Date.now() - (opts.ageMs ?? 0)),
    })),
  );
}

function mcpCtx(tx: DB): ServiceContext {
  return { ...makeMcpCtx(workspace, { keyId: KEY }), db: tx };
}

describe("assertCreateBudget", () => {
  test("is a no-op for non-mcp actors", async () => {
    await expect(
      assertCreateBudget(makeUserCtx(workspace, { userId: 1 })),
    ).resolves.toBeUndefined();
    await expect(
      assertCreateBudget(makeApiKeyCtx(workspace, { keyId: KEY })),
    ).resolves.toBeUndefined();
  });

  test("passes below the cap and throws at it", async () => {
    await withTestTransaction(async (tx) => {
      await seedCreates(tx, 29);
      await expect(assertCreateBudget(mcpCtx(tx))).resolves.toBeUndefined();
      await seedCreates(tx, 1);
      await expect(assertCreateBudget(mcpCtx(tx))).rejects.toThrow(
        PreconditionFailedError,
      );
      await expect(assertCreateBudget(mcpCtx(tx))).rejects.toThrow("30");
      await expect(
        assertCreateBudget(mcpCtx(tx), { perHour: 31 }),
      ).resolves.toBeUndefined();
    });
  });

  test("only counts this key's recent creates", async () => {
    await withTestTransaction(async (tx) => {
      await seedCreates(tx, 30, { keyId: "other-key" });
      await seedCreates(tx, 30, { action: "monitor.update" });
      await seedCreates(tx, 30, { ageMs: 2 * 60 * 60_000 });
      await expect(assertCreateBudget(mcpCtx(tx))).resolves.toBeUndefined();
    });
  });

  test("counts page_component_group creates", async () => {
    await withTestTransaction(async (tx) => {
      await seedCreates(tx, 30, { action: "page_component_group.create" });
      await expect(assertCreateBudget(mcpCtx(tx))).rejects.toThrow(
        PreconditionFailedError,
      );
    });
  });

  test("uses the committed db when no tx is threaded", async () => {
    try {
      await seedCreates(db, 30);
      await expect(
        assertCreateBudget(makeMcpCtx(workspace, { keyId: KEY })),
      ).rejects.toThrow(PreconditionFailedError);
    } finally {
      await clearAuditLog(workspace.id);
    }
  });
});
