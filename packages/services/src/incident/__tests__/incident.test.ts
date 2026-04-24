import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { db, eq } from "@openstatus/db";
import { incidentTable, monitor } from "@openstatus/db/src/schema";

import {
  SEEDED_WORKSPACE_FREE_ID,
  SEEDED_WORKSPACE_TEAM_ID,
} from "../../../test/fixtures";
import {
  clearAuditLog,
  expectAuditRow,
  loadSeededWorkspace,
  makeUserCtx,
} from "../../../test/helpers";
import type { ServiceContext } from "../../context";
import { ConflictError, NotFoundError } from "../../errors";
import { acknowledgeIncident } from "../acknowledge";
import { deleteIncident } from "../delete";
import { getIncident, listIncidents } from "../list";
import { resolveIncident } from "../resolve";

const TEST_PREFIX = "svc-incident-test";

let teamCtx: ServiceContext;
let freeCtx: ServiceContext;
let testMonitorId: number;

beforeAll(async () => {
  const team = await loadSeededWorkspace(SEEDED_WORKSPACE_TEAM_ID);
  const free = await loadSeededWorkspace(SEEDED_WORKSPACE_FREE_ID);
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

beforeEach(async () => {
  await clearAuditLog(teamCtx.workspace.id);
  await clearAuditLog(freeCtx.workspace.id);
});

let nextStartedAtOffset = 0;
async function insertIncident(opts: {
  workspaceId: number;
  monitorId: number;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}) {
  // Unique `(monitor_id, started_at)` constraint means we bump per-test.
  nextStartedAtOffset += 1;
  const startedAt = new Date(Date.now() - nextStartedAtOffset * 60 * 1000);
  const row = await db
    .insert(incidentTable)
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

describe("acknowledgeIncident", () => {
  test("stamps acknowledgedAt + acknowledgedBy and emits audit", async () => {
    const incident = await insertIncident({
      workspaceId: teamCtx.workspace.id,
      monitorId: testMonitorId,
    });

    const updated = await acknowledgeIncident({
      ctx: teamCtx,
      input: { id: incident.id },
    });

    expect(updated.acknowledgedAt).toBeInstanceOf(Date);
    expect(updated.acknowledgedBy).toBe(1);

    await expectAuditRow({
      workspaceId: teamCtx.workspace.id,
      action: "incident.update",
      entityType: "incident",
      entityId: incident.id,
    });

    await db.delete(incidentTable).where(eq(incidentTable.id, incident.id));
  });

  test("throws ConflictError when already acknowledged", async () => {
    const incident = await insertIncident({
      workspaceId: teamCtx.workspace.id,
      monitorId: testMonitorId,
      acknowledgedAt: new Date(),
    });

    await expect(
      acknowledgeIncident({ ctx: teamCtx, input: { id: incident.id } }),
    ).rejects.toBeInstanceOf(ConflictError);

    await db.delete(incidentTable).where(eq(incidentTable.id, incident.id));
  });

  test("throws NotFoundError for a cross-workspace incident", async () => {
    const incident = await insertIncident({
      workspaceId: teamCtx.workspace.id,
      monitorId: testMonitorId,
    });

    await expect(
      acknowledgeIncident({ ctx: freeCtx, input: { id: incident.id } }),
    ).rejects.toBeInstanceOf(NotFoundError);

    await db.delete(incidentTable).where(eq(incidentTable.id, incident.id));
  });
});

describe("resolveIncident", () => {
  test("stamps resolvedAt + resolvedBy", async () => {
    const incident = await insertIncident({
      workspaceId: teamCtx.workspace.id,
      monitorId: testMonitorId,
    });

    const updated = await resolveIncident({
      ctx: teamCtx,
      input: { id: incident.id },
    });
    expect(updated.resolvedAt).toBeInstanceOf(Date);
    expect(updated.resolvedBy).toBe(1);

    await db.delete(incidentTable).where(eq(incidentTable.id, incident.id));
  });

  test("throws ConflictError when already resolved", async () => {
    const incident = await insertIncident({
      workspaceId: teamCtx.workspace.id,
      monitorId: testMonitorId,
      resolvedAt: new Date(),
    });

    await expect(
      resolveIncident({ ctx: teamCtx, input: { id: incident.id } }),
    ).rejects.toBeInstanceOf(ConflictError);

    await db.delete(incidentTable).where(eq(incidentTable.id, incident.id));
  });

  test("throws NotFoundError for a cross-workspace incident", async () => {
    const incident = await insertIncident({
      workspaceId: teamCtx.workspace.id,
      monitorId: testMonitorId,
    });

    await expect(
      resolveIncident({ ctx: freeCtx, input: { id: incident.id } }),
    ).rejects.toBeInstanceOf(NotFoundError);

    await db.delete(incidentTable).where(eq(incidentTable.id, incident.id));
  });
});

describe("deleteIncident", () => {
  test("removes the row and emits audit", async () => {
    const incident = await insertIncident({
      workspaceId: teamCtx.workspace.id,
      monitorId: testMonitorId,
    });

    await deleteIncident({ ctx: teamCtx, input: { id: incident.id } });

    const remaining = await db
      .select()
      .from(incidentTable)
      .where(eq(incidentTable.id, incident.id))
      .all();
    expect(remaining).toHaveLength(0);

    await expectAuditRow({
      workspaceId: teamCtx.workspace.id,
      action: "incident.delete",
      entityType: "incident",
      entityId: incident.id,
    });
  });

  test("throws NotFoundError for cross-workspace delete", async () => {
    const incident = await insertIncident({
      workspaceId: teamCtx.workspace.id,
      monitorId: testMonitorId,
    });

    await expect(
      deleteIncident({ ctx: freeCtx, input: { id: incident.id } }),
    ).rejects.toBeInstanceOf(NotFoundError);

    await db.delete(incidentTable).where(eq(incidentTable.id, incident.id));
  });
});

describe("list / get", () => {
  test("respects workspace isolation and enriches monitor", async () => {
    const incident = await insertIncident({
      workspaceId: teamCtx.workspace.id,
      monitorId: testMonitorId,
    });

    const full = await getIncident({
      ctx: teamCtx,
      input: { id: incident.id },
    });
    expect(full.monitor?.id).toBe(testMonitorId);

    await expect(
      getIncident({ ctx: freeCtx, input: { id: incident.id } }),
    ).rejects.toBeInstanceOf(NotFoundError);

    const { items } = await listIncidents({
      ctx: freeCtx,
      input: {
        limit: 100,
        offset: 0,
        order: "desc",
      },
    });
    expect(items.find((r) => r.id === incident.id)).toBeUndefined();

    await db.delete(incidentTable).where(eq(incidentTable.id, incident.id));
  });

  test("list batch-enriches monitors without duplication", async () => {
    const a = await insertIncident({
      workspaceId: teamCtx.workspace.id,
      monitorId: testMonitorId,
    });
    const b = await insertIncident({
      workspaceId: teamCtx.workspace.id,
      monitorId: testMonitorId,
    });

    const { items } = await listIncidents({
      ctx: teamCtx,
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

    await db
      .delete(incidentTable)
      .where(eq(incidentTable.id, a.id))
      .catch(() => undefined);
    await db
      .delete(incidentTable)
      .where(eq(incidentTable.id, b.id))
      .catch(() => undefined);
  });
});
