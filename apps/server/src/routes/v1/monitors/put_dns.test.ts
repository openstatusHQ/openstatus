import { expect } from "@std/expect";
import { test } from "@std/testing/bdd";

import { app } from "@/index";

import { MonitorSchema } from "./schema";

test("update a dns monitor", async () => {
  const create = await app.request("/v1/monitor/dns", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "OpenStatus",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      request: {
        uri: "openstatus.dev",
      },
      active: true,
      public: true,
    }),
  });

  expect(create.status).toBe(200);
  const created = MonitorSchema.parse(await create.json());

  const res = await app.request(`/v1/monitor/dns/${created.id}`, {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "New Name",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      request: {
        uri: "openstatus.dev",
      },
      active: true,
      public: true,
    }),
  });

  expect(res.status).toBe(200);
  const updated = MonitorSchema.parse(await res.json());
  expect(updated.name).toBe("New Name");

  // Cleanup: delete the created monitor
  await app.request(`/v1/monitor/${created.id}`, {
    method: "DELETE",
    headers: { "x-openstatus-key": "1" },
  });
});

test("updating a tcp monitor via the dns route should return 404", async () => {
  const create = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "OpenStatus",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      request: {
        host: "openstatus.dev",
        port: 443,
      },
      active: true,
      public: true,
    }),
  });

  expect(create.status).toBe(200);
  const created = MonitorSchema.parse(await create.json());

  const res = await app.request(`/v1/monitor/dns/${created.id}`, {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "New Name",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      request: {
        uri: "openstatus.dev",
      },
      active: true,
      public: true,
    }),
  });

  expect(res.status).toBe(404);

  // Cleanup: delete the created monitor
  await app.request(`/v1/monitor/${created.id}`, {
    method: "DELETE",
    headers: { "x-openstatus-key": "1" },
  });
});

test("update the monitor", async () => {
  const res = await app.request("/v1/monitor/dns/1", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "New Name",
    }),
  });

  expect(res.status).toBe(400);
});

test("invalid monitor id should return 404", async () => {
  const res = await app.request("/v1/monitor/dns/404", {
    method: "PUT",
    headers: {
      "x-openstatus-key": "1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "OpenStatus",
      description: "OpenStatus website",
      regions: ["ams", "gru"],
      request: {
        uri: "openstatus.dev",
      },
      active: true,
      public: true,
    }),
  });

  expect(res.status).toBe(404);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/dns/2", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      /* */
    }),
  });

  expect(res.status).toBe(401);
});
