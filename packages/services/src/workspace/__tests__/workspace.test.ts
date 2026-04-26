import { beforeAll, describe, expect, test } from "bun:test";
import { eq } from "@openstatus/db";
import { workspace } from "@openstatus/db/src/schema";

import {
  getWorkspace,
  getWorkspaceWithUsage,
  listWorkspaces,
  updateWorkspaceName,
} from "..";
import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  expectAuditRow,
  loadSeededWorkspace,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";

let teamCtx: ServiceContext;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
});

describe("getWorkspace", () => {
  test("returns the caller's workspace", async () => {
    await withTestTransaction(async (tx) => {
      const result = await getWorkspace({ ctx: { ...teamCtx, db: tx } });
      expect(result.id).toBe(SEEDED_WORKSPACE_TEAM_ID);
      expect(typeof result.limits).toBe("object");
    });
  });
});

describe("getWorkspaceWithUsage", () => {
  test("attaches a zero-or-positive usage block", async () => {
    await withTestTransaction(async (tx) => {
      const result = await getWorkspaceWithUsage({
        ctx: { ...teamCtx, db: tx },
      });
      expect(result.id).toBe(SEEDED_WORKSPACE_TEAM_ID);

      // Iterate the usage object *before* any `toMatchObject` call —
      // bun:test's `toMatchObject` implementation mutates the received
      // object in place, replacing number fields with the
      // `expect.any(Number)` asymmetric-matcher stub on the expected
      // side. Subsequent reads of `result.usage.<key>` then return the
      // matcher object (typeof "object"), not the original count. Do
      // the value-shape + non-negative check first.
      for (const key of [
        "monitors",
        "notifications",
        "pages",
        "pageComponents",
        "checks",
      ] as const) {
        const value = result.usage[key];
        expect(typeof value).toBe("number");
        if (typeof value === "number") {
          expect(value).toBeGreaterThanOrEqual(0);
        }
      }
      expect(result.usage.checks).toBe(0);
    });
  });
});

describe("listWorkspaces", () => {
  test("returns every workspace a user belongs to", async () => {
    await withTestTransaction(async (tx) => {
      const rows = await listWorkspaces({
        ctx: { ...teamCtx, db: tx },
        input: { userId: 1 },
      });
      const ids = rows.map((r) => r.id);
      expect(ids).toContain(SEEDED_WORKSPACE_TEAM_ID);
    });
  });

  test("returns an empty list for a user with no memberships", async () => {
    await withTestTransaction(async (tx) => {
      const rows = await listWorkspaces({
        ctx: { ...teamCtx, db: tx },
        input: { userId: 999_999 },
      });
      expect(rows).toEqual([]);
    });
  });
});

describe("updateWorkspaceName", () => {
  test("renames the workspace and emits an audit row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const nextName = `svc-ws-test-${Date.now()}`;
      await updateWorkspaceName({
        ctx,
        input: { name: nextName },
      });

      const row = await tx
        .select()
        .from(workspace)
        .where(eq(workspace.id, SEEDED_WORKSPACE_TEAM_ID))
        .get();
      expect(row?.name).toBe(nextName);

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "workspace.update",
        entityType: "workspace",
        entityId: SEEDED_WORKSPACE_TEAM_ID,
        actorType: "user",
        db: tx,
      });
    });
  });
});
