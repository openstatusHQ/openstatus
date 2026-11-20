import { and, db, eq } from "@openstatus/db";
import {
  auditLog,
  monitor,
  monitorIncidentTable,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
  type MockInstance,
} from "vitest";

import { stubPublishAuditLog } from "../test/stub-audit-log";
import { checkerAudit } from "../utils/audit-log";
import { openIncident, resolveIncident } from "./incident-utils";

let workspaceId: number;
let publish: MockInstance;

beforeAll(async () => {
  const { workspace } = await createTestWorkspace();
  workspaceId = workspace.id;
});

beforeEach(() => {
  publish = stubPublishAuditLog();
});

afterEach(() => {
  publish.mockRestore();
});

afterAll(async () => {
  await db.delete(auditLog).where(eq(auditLog.workspaceId, workspaceId)).run();
  await db
    .delete(monitorIncidentTable)
    .where(eq(monitorIncidentTable.workspaceId, workspaceId))
    .run();
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId)).run();
});

function auditActions(incidentId: number) {
  return db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.workspaceId, workspaceId),
        eq(auditLog.entityType, "monitor_incident"),
        eq(auditLog.entityId, String(incidentId)),
      ),
    )
    .orderBy(auditLog.id)
    .all()
    .then((rows) => rows.map((row) => [row.action, row.actorId]));
}

test("openIncident creates once, then hands back the open incident", async () => {
  const { id: monitorId } = await createMonitor(workspaceId);

  const first = await openIncident({
    monitorId,
    workspaceId,
    cronTimestamp: 1_800_000_000_000,
  });
  const second = await openIncident({
    monitorId,
    workspaceId,
    cronTimestamp: 1_800_000_060_000,
  });

  expect(first.created).toBe(true);
  expect(first.incident?.startedAt).toEqual(new Date(1_800_000_000_000));
  expect(second.created).toBe(false);
  expect(second.incident?.id).toBe(first.incident?.id);
  expect(await auditActions(first.incident?.id ?? 0)).toEqual([
    ["monitor_incident.create", "checker"],
  ]);
});

test("openIncident throws when the monitor's workspace is unknown", async () => {
  const { id: monitorId } = await createMonitor(workspaceId);

  await expect(
    openIncident({ monitorId, workspaceId: null, cronTimestamp: Date.now() }),
  ).rejects.toThrow("workspace null not found");
});

test("resolveIncident auto-resolves, audits, and publishes one event per incident", async () => {
  const { id: monitorId } = await createMonitor(workspaceId);
  const { incident } = await openIncident({
    monitorId,
    workspaceId,
    cronTimestamp: 1_800_000_000_000,
  });
  const publishFn = checkerAudit.publishAuditLog as unknown as MockInstance;

  const resolved = await resolveIncident({
    monitorId: String(monitorId),
    workspaceId,
    cronTimestamp: 1_800_000_120_000,
  });

  expect(resolved.map((row) => row.id)).toEqual([incident?.id]);
  expect(resolved[0]?.resolvedAt).toEqual(new Date(1_800_000_120_000));
  expect(resolved[0]?.autoResolved).toBe(true);
  expect(await auditActions(incident?.id ?? 0)).toEqual([
    ["monitor_incident.create", "checker"],
    ["monitor_incident.update", "checker"],
  ]);
  expect(publishFn).toHaveBeenCalledTimes(1);
  expect(publishFn).toHaveBeenCalledWith(
    expect.objectContaining({
      action: "incident.resolved",
      metadata: {
        cronTimestamp: 1_800_000_120_000,
        incidentId: incident?.id,
      },
    }),
  );
});

test("resolveIncident returns nothing when no incident is open", async () => {
  const { id: monitorId } = await createMonitor(workspaceId);

  const resolved = await resolveIncident({
    monitorId: String(monitorId),
    workspaceId,
    cronTimestamp: Date.now(),
  });

  expect(resolved).toEqual([]);
});
