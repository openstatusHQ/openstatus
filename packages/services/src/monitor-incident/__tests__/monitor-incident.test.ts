import { db, eq } from "@openstatus/db";
import { monitorIncidentTable, monitor } from "@openstatus/db/src/schema";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { ZodError } from "zod";

import {
  expectAuditRow,
  createWorkspaceFixture,
  makeApiKeyCtx,
  makeUserCtx,
  withTestTransaction,
} from "../../../test/helpers";
import type { DrizzleTx, ServiceContext } from "../../context";
import { ConflictError, ForbiddenError, NotFoundError } from "../../errors";
import { acknowledgeMonitorIncident } from "../acknowledge";
import { excuseMonitorIncident } from "../excuse";
import { getMonitorIncident, listMonitorIncidents } from "../list";
import { resolveMonitorIncident } from "../resolve";
import { unexcuseMonitorIncident } from "../unexcuse";

const TEST_PREFIX = "svc-incident-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
let testMonitorId: number;

beforeAll(async () => {
  const team = (await createWorkspaceFixture("team")).workspace;
  const free = (await createWorkspaceFixture("free")).workspace;
  teamCtx = makeUserCtx(team, { userId: 1 });
  freeCtx = makeUserCtx(free, { userId: 2 });

  const monitorRow = await db
    .insert(monitor)
    .values({
      workspaceId: team.id,
      active: true,
      url: "https://example.com",
      name: `${TEST_PREFIX}-monitor`,
      method: "GET",
      periodicity: "10m",
      regions: "ams",
    })
    .returning()
    .get();
  testMonitorId = monitorRow.id;
});

afterAll(async () => {
  await db
    .delete(monitor)
    .where(eq(monitor.id, testMonitorId))
    .catch(() => undefined);
});

let nextStartedAtOffset = 0;
async function insertIncident(
  tx: DrizzleTx,
  opts: {
    workspaceId: number;
    monitorId: number;
    acknowledgedAt?: Date;
    resolvedAt?: Date;
  },
) {
  // Unique `(monitor_id, started_at)` constraint means we bump per-call.
  nextStartedAtOffset += 1;
  const startedAt = new Date(Date.now() - nextStartedAtOffset * 60 * 1000);
  const row = await tx
    .insert(monitorIncidentTable)
    .values({
      workspaceId: opts.workspaceId,
      monitorId: opts.monitorId,
      startedAt,
      acknowledgedAt: opts.acknowledgedAt ?? null,
      resolvedAt: opts.resolvedAt ?? null,
    })
    .returning()
    .get();
  return row;
}

describe("acknowledgeMonitorIncident", () => {
  test("stamps acknowledgedAt + acknowledgedBy and emits audit", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
      });

      const updated = await acknowledgeMonitorIncident({
        ctx,
        input: { id: incident.id },
      });

      expect(updated.acknowledgedAt).toBeInstanceOf(Date);
      expect(updated.acknowledgedBy).toBe(1);

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "monitor_incident.update",
        entityType: "monitor_incident",
        entityId: incident.id,
        db: tx,
      });
    });
  });

  test("throws ConflictError when already acknowledged", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
        acknowledgedAt: new Date(),
      });

      await expect(
        acknowledgeMonitorIncident({ ctx, input: { id: incident.id } }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  test("throws NotFoundError for a cross-workspace incident", async () => {
    await withTestTransaction(async (tx) => {
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
      });

      await expect(
        acknowledgeMonitorIncident({
          ctx: { ...freeCtx, db: tx },
          input: { id: incident.id },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("rejects read-only actor", async () => {
    await withTestTransaction(async (tx) => {
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
      });
      const ctx = {
        ...makeApiKeyCtx(teamCtx.workspace, {
          keyId: "k-read",
          userId: 1,
          scopes: ["read"],
        }),
        db: tx,
      };
      await expect(
        acknowledgeMonitorIncident({ ctx, input: { id: incident.id } }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});

describe("resolveMonitorIncident", () => {
  test("stamps resolvedAt + resolvedBy", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
      });

      const updated = await resolveMonitorIncident({
        ctx,
        input: { id: incident.id },
      });
      expect(updated.resolvedAt).toBeInstanceOf(Date);
      expect(updated.resolvedBy).toBe(1);
    });
  });

  test("throws ConflictError when already resolved", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
        resolvedAt: new Date(),
      });

      await expect(
        resolveMonitorIncident({ ctx, input: { id: incident.id } }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  test("throws NotFoundError for a cross-workspace incident", async () => {
    await withTestTransaction(async (tx) => {
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
      });

      await expect(
        resolveMonitorIncident({
          ctx: { ...freeCtx, db: tx },
          input: { id: incident.id },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("excuseMonitorIncident", () => {
  test("stamps excusedAt, excusedBy and reason on a resolved outage", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
        resolvedAt: new Date(),
      });

      const updated = await excuseMonitorIncident({
        ctx,
        input: { id: incident.id, reason: "Upstream DNS provider outage" },
      });

      expect(updated.excusedAt).toBeInstanceOf(Date);
      expect(updated.excusedBy).toBe(1);
      expect(updated.excusedReason).toBe("Upstream DNS provider outage");

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "monitor_incident.update",
        entityType: "monitor_incident",
        entityId: incident.id,
        db: tx,
      });
    });
  });

  test("requires a non-empty reason", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
        resolvedAt: new Date(),
      });

      await expect(
        excuseMonitorIncident({
          ctx,
          input: { id: incident.id, reason: "  " },
        }),
      ).rejects.toBeInstanceOf(ZodError);
    });
  });

  test("rejects an outage that is already excused and keeps its reason", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
        resolvedAt: new Date(),
      });
      await excuseMonitorIncident({
        ctx,
        input: { id: incident.id, reason: "first" },
      });

      await expect(
        excuseMonitorIncident({
          ctx,
          input: { id: incident.id, reason: "second" },
        }),
      ).rejects.toBeInstanceOf(ConflictError);
      const row = await tx
        .select({ reason: monitorIncidentTable.excusedReason })
        .from(monitorIncidentTable)
        .where(eq(monitorIncidentTable.id, incident.id))
        .get();
      expect(row?.reason).toBe("first");
    });
  });

  test("rejects an open outage", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
      });

      await expect(
        excuseMonitorIncident({
          ctx,
          input: { id: incident.id, reason: "Still failing" },
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  test("throws NotFoundError for a cross-workspace incident", async () => {
    await withTestTransaction(async (tx) => {
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
        resolvedAt: new Date(),
      });

      await expect(
        excuseMonitorIncident({
          ctx: { ...freeCtx, db: tx },
          input: { id: incident.id, reason: "Not mine" },
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  test("rejects read-only actor", async () => {
    const ctx = makeApiKeyCtx(teamCtx.workspace, {
      keyId: "k-read",
      userId: 1,
      scopes: ["monitors:read"],
    });
    await expect(
      excuseMonitorIncident({ ctx, input: { id: 1, reason: "x" } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("unexcuseMonitorIncident", () => {
  test("clears all excuse columns and emits audit", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
        resolvedAt: new Date(),
      });
      await excuseMonitorIncident({
        ctx,
        input: { id: incident.id, reason: "Planned migration" },
      });

      const updated = await unexcuseMonitorIncident({
        ctx,
        input: { id: incident.id },
      });

      expect(updated.excusedAt).toBeNull();
      expect(updated.excusedBy).toBeNull();
      expect(updated.excusedReason).toBeNull();

      await expectAuditRow({
        workspaceId: teamCtx.workspace.id,
        action: "monitor_incident.update",
        entityType: "monitor_incident",
        entityId: incident.id,
        db: tx,
      });
    });
  });

  test("rejects read-only actor", async () => {
    const ctx = makeApiKeyCtx(teamCtx.workspace, {
      keyId: "k-read",
      userId: 1,
      scopes: ["monitors:read"],
    });
    await expect(
      unexcuseMonitorIncident({ ctx, input: { id: 1 } }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("list / get", () => {
  test("respects workspace isolation and enriches monitor", async () => {
    await withTestTransaction(async (tx) => {
      const teamCtxTx = { ...teamCtx, db: tx };
      const freeCtxTx = { ...freeCtx, db: tx };
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
      });

      const full = await getMonitorIncident({
        ctx: teamCtxTx,
        input: { id: incident.id },
      });
      expect(full.monitor?.id).toBe(testMonitorId);

      await expect(
        getMonitorIncident({ ctx: freeCtxTx, input: { id: incident.id } }),
      ).rejects.toBeInstanceOf(NotFoundError);

      const { items } = await listMonitorIncidents({
        ctx: freeCtxTx,
        input: {
          limit: 100,
          offset: 0,
          order: "desc",
        },
      });
      expect(items.find((r) => r.id === incident.id)).toBeUndefined();
    });
  });

  test("list batch-enriches monitors without duplication", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const a = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
      });
      // Only one incident per monitor may be open at a time
      // (partial unique index `monitor_incident_open_idx`), so the second is resolved.
      const b = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
        resolvedAt: new Date(),
      });

      const { items } = await listMonitorIncidents({
        ctx,
        input: {
          limit: 100,
          offset: 0,
          order: "desc",
          monitorId: testMonitorId,
        },
      });

      // Both incidents share the monitor — they should share the same enriched
      // Monitor object (same-pageId dedup logic in the batch loader).
      const ours = items.filter((i) => i.id === a.id || i.id === b.id);
      expect(ours).toHaveLength(2);
      expect(ours[0]?.monitor?.id).toBe(testMonitorId);
      expect(ours[1]?.monitor?.id).toBe(testMonitorId);
    });
  });

  test("attributes who acknowledged and resolved", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
      });
      await acknowledgeMonitorIncident({ ctx, input: { id: incident.id } });
      await resolveMonitorIncident({ ctx, input: { id: incident.id } });

      const full = await getMonitorIncident({
        ctx,
        input: { id: incident.id },
      });
      expect(full.acknowledgedByUser?.id).toBe(1);
      expect(full.resolvedByUser?.id).toBe(1);
    });
  });

  test("attributes who excused, without filtering excused rows", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
        resolvedAt: new Date(),
      });
      await excuseMonitorIncident({
        ctx,
        input: { id: incident.id, reason: "Provider outage" },
      });

      const { items } = await listMonitorIncidents({
        ctx,
        input: {
          limit: 100,
          offset: 0,
          order: "desc",
          monitorId: testMonitorId,
        },
      });
      const row = items.find((i) => i.id === incident.id);
      expect(row?.excusedReason).toBe("Provider outage");
      expect(row?.excusedByUser?.id).toBe(1);
    });
  });

  test("leaves attribution empty for an auto-resolved incident", async () => {
    await withTestTransaction(async (tx) => {
      const ctx = { ...teamCtx, db: tx };
      const incident = await insertIncident(tx, {
        workspaceId: teamCtx.workspace.id,
        monitorId: testMonitorId,
        resolvedAt: new Date(),
      });

      const full = await getMonitorIncident({
        ctx,
        input: { id: incident.id },
      });
      expect(full.acknowledgedByUser).toBeNull();
      expect(full.resolvedByUser).toBeNull();
      expect(full.excusedByUser).toBeNull();
    });
  });
});
