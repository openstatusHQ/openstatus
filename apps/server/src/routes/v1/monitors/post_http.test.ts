import { expect, test } from "bun:test";

import { app } from "@/index";
import { MonitorSchema } from "./schema";



test("create a valid monitor", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      "active": true,
      "degradedAfter": 60,
      "description": "This is a test",
      "frequency": "10m",
      "kind": "tcp",
      "name": "Test2",
      "regions": [
        "iad"
      ],
      "request": {
        "host": "openstat.us",
        "port": 80
      },
      "retry": 3
      "active": true,
      "degradedAfter": 60,
      "description": "This is a test",
      "frequency": "10m",
      "name": "Test2",
      "regions": [
        "iad"
      ],
      request: {
        url: "https://api.openstatus.dev/health",
        method: "POST",
        body: '{"hello":"world"}',
        headers: { "content-type": "application/json" },
      },
      assertions: [{
        kind: "statusCode",
        compare: "eq",
        target: 200,
      },
      { kind: "header",compare: "not_eq", key: "key", target: "value" }],
      "retry": 3
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());

  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create a status report with invalid payload should return 400", async () => {
  const res = await app.request("/v1/monitor/http", {
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
        url: "https://www.openstatus.dev",
        method: "POST",
        body: '{"hello":"world"}',
        headers: { "content-type": "application/json" },
      },
      active: true,
      public: true,
      assertions: [
        {
          kind: "status",
          compare: "eq",
          target: 200,
        },
        { kind: "header", compare: "not_eq", key: "key", target: "value" },
      ],
    }),
  });

  expect(res.status).toBe(400);
});

test("no auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});

test("create HTTP monitor with GET method should return 200", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "5m",
      name: "GET Monitor",
      description: "Monitor with GET method",
      regions: ["ams"],
      request: {
        url: "https://api.openstatus.dev/health",
        method: "GET",
      },
      active: true,
      public: false,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create HTTP monitor with PUT method should return 200", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "PUT Monitor",
      description: "Monitor with PUT method",
      regions: ["gru"],
      request: {
        url: "https://api.example.com/resource",
        method: "PUT",
        body: '{"data":"updated"}',
        headers: { authorization: "Bearer token123" },
      },
      active: true,
      public: false,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create HTTP monitor with textBody assertion should return 200", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "Text Body Assertion Monitor",
      description: "Monitor with text body assertion",
      regions: ["ams"],
      request: {
        url: "https://www.openstatus.dev",
        method: "GET",
      },
      assertions: [
        {
          kind: "textBody",
          compare: "contains",
          target: "OpenStatus",
        },
      ],
      active: true,
      public: true,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create HTTP monitor with multiple assertions should return 200", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "Multi Assertion Monitor",
      description: "Monitor with multiple assertions",
      regions: ["ams", "gru"],
      request: {
        url: "https://api.openstatus.dev",
        method: "GET",
      },
      assertions: [
        {
          kind: "statusCode",
          compare: "eq",
          target: 200,
        },
        {
          kind: "header",
          compare: "contains",
          key: "content-type",
          target: "json",
        },
        {
          kind: "textBody",
          compare: "contains",
          target: "success",
        },
      ],
      active: true,
      public: true,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create HTTP monitor with timeout and retry configuration should return 200", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "HTTP with custom config",
      description: "HTTP monitor with timeout and retry",
      regions: ["ams"],
      request: {
        url: "https://www.openstatus.dev",
        method: "GET",
      },
      timeout: 60000,
      retry: 5,
      degradedAfter: 20000,
      active: true,
      public: false,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create HTTP monitor with OpenTelemetry configuration should return 200", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "HTTP with OTEL",
      description: "HTTP monitor with OpenTelemetry",
      regions: ["ams"],
      request: {
        url: "https://www.openstatus.dev",
        method: "GET",
      },
      openTelemetry: {
        endpoint: "https://otel.example.com/v1/traces",
        headers: {
          "x-api-key": "otel-key-123",
          "x-tenant-id": "tenant-456",
        },
      },
      active: true,
      public: false,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create HTTP monitor with 30s frequency should return 200", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "30s",
      name: "Fast HTTP Check",
      description: "HTTP monitor with 30s frequency",
      regions: ["ams"],
      request: {
        url: "https://www.openstatus.dev",
        method: "GET",
      },
      active: true,
      public: false,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create HTTP monitor with 1h frequency should return 200", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "1h",
      name: "Hourly HTTP Check",
      description: "HTTP monitor with 1h frequency",
      regions: ["gru"],
      request: {
        url: "https://www.openstatus.dev",
        method: "GET",
      },
      active: true,
      public: false,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create HTTP monitor without optional fields should return 200", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "Minimal HTTP Monitor",
      regions: ["ams"],
      request: {
        url: "https://www.openstatus.dev",
        method: "GET",
      },
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create HTTP monitor with PATCH method should return 200", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "PATCH Monitor",
      description: "Monitor with PATCH method",
      regions: ["ams"],
      request: {
        url: "https://api.example.com/resource",
        method: "PATCH",
        body: '{"field":"value"}',
        headers: { "content-type": "application/json" },
      },
      active: true,
      public: false,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create HTTP monitor with DELETE method should return 200", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "DELETE Monitor",
      description: "Monitor with DELETE method",
      regions: ["ams"],
      request: {
        url: "https://api.example.com/resource/123",
        method: "DELETE",
        headers: { authorization: "Bearer token" },
      },
      active: true,
      public: false,
    }),
  });

  const result = MonitorSchema.safeParse(await res.json());
  expect(res.status).toBe(200);
  expect(result.success).toBe(true);
});

test("create HTTP monitor with invalid URL should return 400", async () => {
  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "Invalid URL Monitor",
      regions: ["ams"],
      request: {
        url: "not-a-valid-url",
        method: "GET",
      },
    }),
  });

  expect(res.status).toBe(400);
});

test("create HTTP monitor with deprecated regions should return 400", async () => {

  const res = await app.request("/v1/monitor/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      frequency: "10m",
      name: "Deprecated Regions HTTP",
      regions: ["ams", "hkg", "waw"],
      request: {
        url: "https://www.openstatus.dev",
        method: "GET",
      },
    }),
  });

  expect(res.status).toBe(400);
});
