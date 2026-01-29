import { expect, test } from "bun:test";

import { app } from "@/index";
import { MonitorSchema } from "./schema";

test("create a valid monitor", async () => {
  const res = await app.request("/v1/monitor/tcp", {
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
  const r = await res.json();
  const result = MonitorSchema.safeParse(r);
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);

  // Cleanup: delete the created monitor
  if (result.success) {
    await app.request(`/v1/monitor/${result.data.id}`, {
      method: "DELETE",
      headers: { "x-openstatus-key": "1" },
    });
  }
});

test("create a status report with invalid payload should return 400", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "21m",
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

  expect(res.status).toBe(400);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});

test("create TCP monitor with port 80 should return 200", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "5m",
      name: "HTTP Port Monitor",
      description: "Monitor port 80",
      regions: ["ams"],
      request: {
        host: "example.com",
        port: 80,
      },
      active: true,
      public: false,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);

  // Cleanup: delete the created monitor
  if (result.success) {
    await app.request(`/v1/monitor/${result.data.id}`, {
      method: "DELETE",
      headers: { "x-openstatus-key": "1" },
    });
  }
});

test("create TCP monitor with custom port should return 200", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "1m",
      name: "Custom Port Monitor",
      description: "Monitor custom port 8080",
      regions: ["gru"],
      request: {
        host: "localhost",
        port: 8080,
      },
      active: false,
      public: false,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);

  // Cleanup: delete the created monitor
  if (result.success) {
    await app.request(`/v1/monitor/${result.data.id}`, {
      method: "DELETE",
      headers: { "x-openstatus-key": "1" },
    });
  }
});

test("create TCP monitor with timeout and retry configuration should return 200", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "TCP with custom config",
      description: "TCP monitor with timeout and retry",
      regions: ["ams"],
      request: {
        host: "openstatus.dev",
        port: 443,
      },
      timeout: 30000,
      retry: 5,
      degradedAfter: 10000,
      active: true,
      public: true,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);

  // Cleanup: delete the created monitor
  if (result.success) {
    await app.request(`/v1/monitor/${result.data.id}`, {
      method: "DELETE",
      headers: { "x-openstatus-key": "1" },
    });
  }
});

test("create TCP monitor with OpenTelemetry configuration should return 200", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "TCP with OTEL",
      description: "TCP monitor with OpenTelemetry",
      regions: ["ams"],
      request: {
        host: "openstatus.dev",
        port: 443,
      },
      openTelemetry: {
        endpoint: "https://otel.example.com",
        headers: {
          "x-api-key": "test-key",
        },
      },
      active: true,
      public: false,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);

  // Cleanup: delete the created monitor
  if (result.success) {
    await app.request(`/v1/monitor/${result.data.id}`, {
      method: "DELETE",
      headers: { "x-openstatus-key": "1" },
    });
  }
});

test("create TCP monitor with multiple regions should return 200", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "30m",
      name: "Multi-region TCP",
      description: "TCP monitor across multiple regions",
      regions: ["ams", "gru", "syd"],
      request: {
        host: "openstatus.dev",
        port: 443,
      },
      active: true,
      public: true,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);

  // Cleanup: delete the created monitor
  if (result.success) {
    await app.request(`/v1/monitor/${result.data.id}`, {
      method: "DELETE",
      headers: { "x-openstatus-key": "1" },
    });
  }
});

test("create TCP monitor with 30s frequency should return 200", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "30s",
      name: "Fast TCP Check",
      description: "TCP monitor with 30s frequency",
      regions: ["ams"],
      request: {
        host: "openstatus.dev",
        port: 443,
      },
      active: true,
      public: false,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);

  // Cleanup: delete the created monitor
  if (result.success) {
    await app.request(`/v1/monitor/${result.data.id}`, {
      method: "DELETE",
      headers: { "x-openstatus-key": "1" },
    });
  }
});

test("create TCP monitor with 1h frequency should return 200", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "1h",
      name: "Hourly TCP Check",
      description: "TCP monitor with 1h frequency",
      regions: ["gru"],
      request: {
        host: "example.com",
        port: 443,
      },
      active: true,
      public: false,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);

  // Cleanup: delete the created monitor
  if (result.success) {
    await app.request(`/v1/monitor/${result.data.id}`, {
      method: "DELETE",
      headers: { "x-openstatus-key": "1" },
    });
  }
});

test("create TCP monitor without optional fields should return 200", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "Minimal TCP Monitor",
      regions: ["ams"],
      request: {
        host: "openstatus.dev",
        port: 443,
      },
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);

  // Cleanup: delete the created monitor
  if (result.success) {
    await app.request(`/v1/monitor/${result.data.id}`, {
      method: "DELETE",
      headers: { "x-openstatus-key": "1" },
    });
  }
});

test("create TCP monitor with invalid host should return 400", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "Invalid TCP Monitor",
      regions: ["ams"],
      request: {
        host: "",
        port: 443,
      },
    }),
  });

  expect(res.status).toBe(400);
});

test("create TCP monitor with invalid port should return 400", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "Invalid Port Monitor",
      regions: ["ams"],
      request: {
        host: "openstatus.dev",
        port: "not-a-number",
      },
    }),
  });

  expect(res.status).toBe(400);
});

test("create TCP monitor with deprecated regions should return 400", async () => {
  const res = await app.request("/v1/monitor/tcp", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "Deprecated Regions TCP",
      regions: ["ams", "hkg", "waw"],
      request: {
        host: "openstatus.dev",
        port: 443,
      },
    }),
  });

  expect(res.status).toBe(400);
});
