import { db, eq, inArray } from "@openstatus/db";
import { incident, incidentEvent } from "@openstatus/db/src/schema";
import { createIncident } from "@openstatus/db/src/test/factories";
import { clearAuditLogFor } from "@openstatus/services/test/helpers";
import { expect } from "@std/expect";
import { afterAll, test } from "@std/testing/bdd";
import { TRPCError } from "@trpc/server";

import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

const created: number[] = [];

function caller() {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: "1" } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: 1 },
  });
  return edgeRouter.createCaller(ctx);
}

afterAll(async () => {
  if (created.length === 0) return;
  const events = await db
    .delete(incidentEvent)
    .where(inArray(incidentEvent.incidentId, created))
    .returning({ id: incidentEvent.id });
  await db.delete(incident).where(inArray(incident.id, created));
  await clearAuditLogFor({ entityType: "incident", entityIds: created });
  await clearAuditLogFor({
    entityType: "incident_event",
    entityIds: events.map((e) => e.id),
  });
});

test("declare, move and read an incident through tRPC", async () => {
  const api = caller();
  const row = await api.incident.declare({
    title: "Router test",
    severity: "minor",
    commanderId: 1,
  });
  if (!row) throw new Error("declare returned nothing");
  created.push(row.id);

  await api.incident.setStatus({ id: row.id, status: "mitigated" });
  const got = await api.incident.get({ id: row.id });
  expect(got?.status).toBe("mitigated");
  expect(got?.allowedTransitions).toEqual(["resolved", "open", "canceled"]);
  expect(got?.deletable).toBe(false);

  const events = await api.incident.listEvents({ id: row.id });
  expect(events?.map((e) => e.type)).toEqual(["status_changed", "declared"]);
});

test("another workspace's incident is not found", async () => {
  const theirs = await createIncident(3);
  created.push(theirs.id);
  try {
    await caller().incident.get({ id: theirs.id });
    throw new Error("Should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("NOT_FOUND");
  }
  const stillThere = await db
    .select()
    .from(incident)
    .where(eq(incident.id, theirs.id))
    .get();
  expect(stillThere).toBeDefined();
});
