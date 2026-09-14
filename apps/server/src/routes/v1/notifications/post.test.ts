import { db, eq } from "@openstatus/db";
import {
  notification,
  notificationsToMonitors,
} from "@openstatus/db/src/schema";
import {
  createMonitor,
  createTestWorkspace,
} from "@openstatus/db/src/test/factories";
import { expect } from "@std/expect";
import { afterEach, beforeAll, test } from "@std/testing/bdd";

import { app } from "@/index";

import { NotificationSchema } from "./schema";

let workspaceId: number;
let monitorId: number;

beforeAll(async () => {
  const { workspace } = await createTestWorkspace();
  workspaceId = workspace.id;
  monitorId = (await createMonitor(workspaceId)).id;
});

afterEach(async () => {
  await db
    .delete(notificationsToMonitors)
    .where(eq(notificationsToMonitors.monitorId, monitorId));
  await db
    .delete(notification)
    .where(eq(notification.workspaceId, workspaceId));
});

function createChannel(input: unknown) {
  return app.request("/v1/notification", {
    method: "POST",
    headers: {
      "x-openstatus-key": String(workspaceId),
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

for (const { provider, payload } of [
  { provider: "email", payload: { email: "ping@openstatus.dev" } },
  { provider: "sms", payload: { sms: "+12025550123" } },
  {
    provider: "webhook",
    payload: {
      webhook: {
        endpoint: "https://example.com/notify",
        headers: [{ key: "x-channel", value: "test" }],
      },
    },
  },
  {
    provider: "email",
    payload: {
      email: "ping@openstatus.dev",
      discord: "https://example.com/notify",
    },
  },
]) {
  test(`create and read a ${provider} notification with ${JSON.stringify(payload)}`, async () => {
    const res = await createChannel({
      name: "OpenStatus",
      provider,
      payload,
      monitors: [monitorId],
    });
    const result = NotificationSchema.parse(await res.json());
    expect(res.status).toBe(200);
    expect(result).toMatchObject({ provider, payload, monitors: [monitorId] });

    const read = await app.request(`/v1/notification/${result.id}`, {
      headers: { "x-openstatus-key": String(workspaceId) },
    });
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual(result);
  });
}

test("create a notification with invalid monitor ids should return a 400", async () => {
  const res = await createChannel({
    name: "OpenStatus",
    provider: "email",
    payload: { email: "ping@openstatus.dev" },
    monitors: [-1],
  });
  expect(res.status).toBe(400);
});

for (const { name, payload } of [
  { name: "unknown payload key", payload: { hello: "world" } },
  { name: "wrong provider", payload: { sms: "+12025550123" } },
  {
    name: "invalid selected provider with valid alternate provider",
    payload: { email: "invalid", sms: "+12025550123" },
  },
  { name: "null payload", payload: null },
  { name: "missing payload", payload: undefined },
]) {
  test(`reject ${name} before persisting a notification or monitor link`, async () => {
    const res = await createChannel({
      name: "OpenStatus",
      provider: "email",
      payload,
      monitors: [monitorId],
    });
    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.workspaceId, workspaceId));
    const links = await db
      .select()
      .from(notificationsToMonitors)
      .where(eq(notificationsToMonitors.monitorId, monitorId));

    expect({ status: res.status, rows, links }).toEqual({
      status: 400,
      rows: [],
      links: [],
    });
  });
}

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/notification", {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  expect(res.status).toBe(401);
});
