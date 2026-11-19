import { db, eq } from "@openstatus/db";
import { monitor, monitorIncidentTable } from "@openstatus/db/src/schema";
import {
  createMonitor,
  createWorkspace,
} from "@openstatus/db/src/test/factories";
import { TRPCError } from "@trpc/server";
import { afterAll, beforeAll, expect, test } from "vitest";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

// Passing both `user` and `workspace` trips the NODE_ENV=test escape hatch in
// the authed middleware, so the caller is scoped to the given workspace.
function callerFor(workspaceId: number) {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal user for test
    user: { id: 1 },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: workspaceId },
  });
  return edgeRouter.createCaller(ctx);
}

let ownWorkspaceId: number;
let otherWorkspaceId: number;
let monitorName: string;
let incidentId: number;

beforeAll(async () => {
  ownWorkspaceId = (await createWorkspace()).id;
  otherWorkspaceId = (await createWorkspace()).id;
  const ownMonitor = await createMonitor(ownWorkspaceId);
  monitorName = ownMonitor.name;
  const incident = await db
    .insert(monitorIncidentTable)
    .values({
      monitorId: ownMonitor.id,
      workspaceId: ownWorkspaceId,
      startedAt: new Date("2026-01-02T03:04:05Z"),
      resolvedAt: new Date("2026-01-02T03:24:05Z"),
      autoResolved: true,
    })
    .returning()
    .get();
  incidentId = incident.id;
});

afterAll(async () => {
  await db
    .delete(monitorIncidentTable)
    .where(eq(monitorIncidentTable.id, incidentId))
    .run();
  await db.delete(monitor).where(eq(monitor.workspaceId, ownWorkspaceId)).run();
});

test("get returns the incident with its monitor", async () => {
  const incident = await callerFor(ownWorkspaceId).monitorIncident.get({
    id: incidentId,
  });

  expect(incident?.id).toBe(incidentId);
  expect(incident?.monitor?.name).toBe(monitorName);
  expect(incident?.autoResolved).toBe(true);
  expect(incident?.resolvedByUser).toBeNull();
});

test("get is NOT_FOUND for another workspace's incident", async () => {
  const error = await callerFor(otherWorkspaceId)
    .monitorIncident.get({ id: incidentId })
    .catch((e) => e);

  expect(error).toBeInstanceOf(TRPCError);
  expect(error.code).toBe("NOT_FOUND");
});
