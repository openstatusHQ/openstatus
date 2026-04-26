import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import { monitorTag } from "@openstatus/db/src/schema";

import { listMonitorTags, syncMonitorTags } from "..";
import { SEEDED_WORKSPACE_TEAM_ID } from "../../../test/fixtures";
import {
  clearAuditLog,
  loadSeededWorkspace,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";

let teamCtx: ServiceContext;

async function clearWorkspaceTags() {
  await db
    .delete(monitorTag)
    .where(eq(monitorTag.workspaceId, SEEDED_WORKSPACE_TEAM_ID))
    .catch(() => undefined);
}

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  teamCtx = makeUserCtx(team, { userId: 1 });
  // Wipe rows from prior aborted runs so tests can assert exact counts.
  await clearWorkspaceTags();
  await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID);
});

afterAll(async () => {
  await clearWorkspaceTags();
});

describe("syncMonitorTags", () => {
  test("creates new tags when input has no ids; emits monitor_tag.create per row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const result = await syncMonitorTags({
        ctx,
        input: {
          tags: [
            { name: "alpha", color: "red" },
            { name: "beta", color: "blue" },
          ],
        },
      });

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name).sort()).toEqual(["alpha", "beta"]);

      const auditRows = await readAuditLog({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        entityType: "monitor_tag",
        db: tx,
      });
      const creates = auditRows.filter(
        (r) => r.action === "monitor_tag.create",
      );
      expect(creates).toHaveLength(2);
    });
  });

  test("updates an existing tag in place when id present and value changes", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const [{ id: existingId }] = await syncMonitorTags({
        ctx,
        input: { tags: [{ name: "alpha", color: "red" }] },
      });
      await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID, { db: tx });

      await syncMonitorTags({
        ctx,
        input: {
          tags: [{ id: existingId, name: "alpha-renamed", color: "red" }],
        },
      });

      const row = await tx
        .select()
        .from(monitorTag)
        .where(eq(monitorTag.id, existingId))
        .get();
      expect(row?.name).toBe("alpha-renamed");

      const auditRows = await readAuditLog({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        entityType: "monitor_tag",
        entityId: existingId,
        db: tx,
      });
      const updates = auditRows.filter(
        (r) => r.action === "monitor_tag.update",
      );
      expect(updates).toHaveLength(1);
    });
  });

  test("no-op update (same name + color) doesn't write a redundant audit row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const [{ id: existingId }] = await syncMonitorTags({
        ctx,
        input: { tags: [{ name: "alpha", color: "red" }] },
      });
      await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID, { db: tx });

      await syncMonitorTags({
        ctx,
        input: { tags: [{ id: existingId, name: "alpha", color: "red" }] },
      });

      const auditRows = await readAuditLog({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        entityType: "monitor_tag",
        entityId: existingId,
        db: tx,
      });
      // emitAudit suppresses empty-diff updates — only the original
      // create row should remain (cleared above), so zero update rows.
      const updates = auditRows.filter(
        (r) => r.action === "monitor_tag.update",
      );
      expect(updates).toHaveLength(0);
    });
  });

  test("removes tags that aren't in the input; emits monitor_tag.delete per row", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const created = await syncMonitorTags({
        ctx,
        input: {
          tags: [
            { name: "alpha", color: "red" },
            { name: "beta", color: "blue" },
          ],
        },
      });
      await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID, { db: tx });

      const keep = created.find((t) => t.name === "alpha");
      if (!keep) throw new Error("seed setup failed");

      await syncMonitorTags({
        ctx,
        input: { tags: [{ id: keep.id, name: "alpha", color: "red" }] },
      });

      const remaining = await listMonitorTags({ ctx });
      expect(remaining.map((r) => r.name)).toEqual(["alpha"]);

      const auditRows = await readAuditLog({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        entityType: "monitor_tag",
        db: tx,
      });
      const deletes = auditRows.filter(
        (r) => r.action === "monitor_tag.delete",
      );
      expect(deletes).toHaveLength(1);
    });
  });

  test("create / update / delete all in one sync call", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const seed = await syncMonitorTags({
        ctx,
        input: {
          tags: [
            { name: "stays", color: "gray" },
            { name: "drops", color: "gray" },
          ],
        },
      });
      await clearAuditLog(SEEDED_WORKSPACE_TEAM_ID, { db: tx });

      const stays = seed.find((t) => t.name === "stays");
      if (!stays) throw new Error("seed setup failed");

      await syncMonitorTags({
        ctx,
        input: {
          tags: [
            { id: stays.id, name: "stays-renamed", color: "gray" },
            { name: "added", color: "green" },
          ],
        },
      });

      const auditRows = await readAuditLog({
        workspaceId: SEEDED_WORKSPACE_TEAM_ID,
        entityType: "monitor_tag",
        db: tx,
      });
      const byAction = auditRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.action] = (acc[row.action] ?? 0) + 1;
        return acc;
      }, {});
      expect(byAction["monitor_tag.create"]).toBe(1);
      expect(byAction["monitor_tag.update"]).toBe(1);
      expect(byAction["monitor_tag.delete"]).toBe(1);
    });
  });
});
