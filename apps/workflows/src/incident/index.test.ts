import { db, eq } from "@openstatus/db";
import {
  auditLog,
  monitor,
  monitorIncidentTable,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, expect, test } from "vitest";

import { incidentRoute, resolveStaleIncidents } from "./index";

let workspaceId: number;

beforeAll(async () => {
  const { workspace } = await createTestWorkspace();
  workspaceId = workspace.id;
});

afterAll(async () => {
  await db.delete(auditLog).where(eq(auditLog.workspaceId, workspaceId)).run();
  await db
    .delete(monitorIncidentTable)
    .where(eq(monitorIncidentTable.workspaceId, workspaceId))
    .run();
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId)).run();
});

async function monitorWithOpenIncident(
  overrides: Parameters<typeof createMonitor>[1],
) {
  const row = await createMonitor(workspaceId, overrides);
  const incident = await db
    .insert(monitorIncidentTable)
    .values({ monitorId: row.id, workspaceId, startedAt: new Date() })
    .returning()
    .get();
  return incident.id;
}

function readIncident(id: number) {
  return db
    .select()
    .from(monitorIncidentTable)
    .where(eq(monitorIncidentTable.id, id))
    .get();
}

function readAudit(incidentId: number) {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.entityId, String(incidentId)))
    .all()
    .then((rows) =>
      rows.filter(
        (row) =>
          row.workspaceId === workspaceId &&
          row.entityType === "monitor_incident",
      ),
    );
}

test("the route rejects a request without the cron secret", async () => {
  const res = await incidentRoute.request("/cleanup");
  expect(res.status).toBe(401);
});

test("auto-resolves and audits the incident of a monitor that is up again", async () => {
  const recovered = await monitorWithOpenIncident({
    active: true,
    status: "active",
  });
  const stillDown = await monitorWithOpenIncident({
    active: true,
    status: "error",
  });
  const paused = await monitorWithOpenIncident({
    active: false,
    status: "active",
  });

  const updated = await resolveStaleIncidents(workspaceId);

  expect(updated).toBe(1);
  const resolved = await readIncident(recovered);
  expect(resolved?.resolvedAt).toBeInstanceOf(Date);
  expect(resolved?.autoResolved).toBe(true);
  expect(resolved?.resolvedBy).toBeNull();
  expect((await readIncident(stillDown))?.resolvedAt).toBeNull();
  expect((await readIncident(paused))?.resolvedAt).toBeNull();

  const rows = await readAudit(recovered);
  expect(rows.map((row) => [row.action, row.actorType, row.actorId])).toEqual([
    ["monitor_incident.update", "system", "incident-cleanup"],
  ]);
  expect(await readAudit(stillDown)).toEqual([]);
  expect(await readAudit(paused)).toEqual([]);
});

test("a second sweep finds nothing left to resolve", async () => {
  expect(await resolveStaleIncidents(workspaceId)).toBe(0);
});
