import { eq } from "@openstatus/db";
import { monitorTag, workspace } from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { beforeAll, describe, test } from "@std/testing/bdd";

import {
  clearAuditLog,
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  readAuditLog,
  withTestTransaction,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ForbiddenError } from "../../errors";
import { listMonitorTags, syncMonitorTags } from "../index.ts";

let teamCtx: ServiceContext;

beforeAll(async () => {
  const team = await createWorkspaceFixture("team");
  teamCtx = makeUserCtx(team.workspace, { userId: team.userId });
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
        workspaceId: teamCtx.workspace.id,
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
      await clearAuditLog(teamCtx.workspace.id, { db: tx });

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
        workspaceId: teamCtx.workspace.id,
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
      await clearAuditLog(teamCtx.workspace.id, { db: tx });

      await syncMonitorTags({
        ctx,
        input: { tags: [{ id: existingId, name: "alpha", color: "red" }] },
      });

      const auditRows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
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
      await clearAuditLog(teamCtx.workspace.id, { db: tx });

      const keep = created.find((t) => t.name === "alpha");
      if (!keep) throw new Error("seed setup failed");

      await syncMonitorTags({
        ctx,
        input: { tags: [{ id: keep.id, name: "alpha", color: "red" }] },
      });

      const remaining = await listMonitorTags({ ctx });
      expect(remaining.map((r) => r.name)).toEqual(["alpha"]);

      const auditRows = await readAuditLog({
        workspaceId: teamCtx.workspace.id,
        entityType: "monitor_tag",
        db: tx,
      });
      const deletes = auditRows.filter(
        (r) => r.action === "monitor_tag.delete",
      );
      expect(deletes).toHaveLength(1);
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const readOnlyCtx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        syncMonitorTags({
          ctx: readOnlyCtx,
          input: { tags: [{ name: "alpha", color: "red" }] },
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
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
      await clearAuditLog(teamCtx.workspace.id, { db: tx });

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
        workspaceId: teamCtx.workspace.id,
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

describe("listMonitorTags", () => {
  test("returns flat tag rows, without the monitor join", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      await syncMonitorTags({
        ctx,
        input: { tags: [{ name: "flat", color: "red" }] },
      });

      const rows = await listMonitorTags({ ctx });
      const row = rows.find((r) => r.name === "flat");
      expect(row).toBeDefined();
      // The join used to ship a full second copy of the monitor table in the
      // same batch as `monitor.list`; no consumer ever read it.
      expect(row && "monitor" in row).toBe(false);
      expect(row?.color).toBe("red");
      expect(row?.workspaceId).toBe(teamCtx.workspace.id);
    });
  });

  test("is scoped to the caller's workspace", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      await syncMonitorTags({
        ctx,
        input: { tags: [{ name: "scoped", color: "green" }] },
      });

      const [foreign] = await tx
        .insert(workspace)
        .values({
          slug: `svc-tag-foreign-${teamCtx.workspace.id}`,
          name: "Foreign",
          stripeId: `svc-tag-stripe-${teamCtx.workspace.id}`,
          plan: "team",
        })
        .returning();
      if (!foreign) throw new Error("workspace insert returned no row");
      await tx.insert(monitorTag).values({
        workspaceId: foreign.id,
        name: "foreign-tag",
        color: "blue",
      });

      const rows = await listMonitorTags({ ctx });
      expect(rows.some((r) => r.name === "scoped")).toBe(true);
      expect(rows.some((r) => r.name === "foreign-tag")).toBe(false);
    });
  });
});
