import { db, eq } from "@openstatus/db";
import { monitor, workspace } from "@openstatus/db/src/schema";
import {
  createMonitor,
  createWorkspace,
} from "@openstatus/db/src/test/factories";
import { afterAll, beforeAll, expect, test } from "vitest";

import { app } from "@/index";

// v1 cannot represent a heartbeat (no url, no schedule), so it never sees one.

let workspaceId: number;
let heartbeatId: number;
let httpId: number;
let headers: Record<string, string>;

beforeAll(async () => {
  workspaceId = (await createWorkspace()).id;
  headers = {
    "x-openstatus-key": String(workspaceId),
    "content-type": "application/json",
  };
  heartbeatId = (
    await createMonitor(workspaceId, {
      jobType: "heartbeat",
      url: "",
      periodicity: "other",
      heartbeatToken: `v1-heartbeat-test-${workspaceId}`,
      heartbeatPeriod: 3600,
      heartbeatGrace: 300,
    })
  ).id;
  httpId = (await createMonitor(workspaceId)).id;
});

afterAll(async () => {
  await db.delete(monitor).where(eq(monitor.workspaceId, workspaceId));
  await db.delete(workspace).where(eq(workspace.id, workspaceId));
});

test("GET /v1/monitor/:id hides a heartbeat", async () => {
  const res = await app.request(`/v1/monitor/${heartbeatId}`, { headers });
  expect(res.status).toBe(404);
});

test("GET /v1/monitor lists every monitor but heartbeats", async () => {
  const res = await app.request("/v1/monitor", { headers });
  expect(res.status).toBe(200);
  const ids = ((await res.json()) as { id: number }[]).map((m) => m.id);
  expect(ids).toContain(httpId);
  expect(ids).not.toContain(heartbeatId);
});

test("PUT /v1/monitor/:id cannot update a heartbeat", async () => {
  const res = await app.request(`/v1/monitor/${heartbeatId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ name: "renamed" }),
  });
  expect(res.status).toBe(404);
});

test("DELETE /v1/monitor/:id cannot delete a heartbeat", async () => {
  const res = await app.request(`/v1/monitor/${heartbeatId}`, {
    method: "DELETE",
    headers,
  });
  expect(res.status).toBe(404);

  const row = await db
    .select({ deletedAt: monitor.deletedAt })
    .from(monitor)
    .where(eq(monitor.id, heartbeatId))
    .get();
  expect(row?.deletedAt).toBeNull();
});
