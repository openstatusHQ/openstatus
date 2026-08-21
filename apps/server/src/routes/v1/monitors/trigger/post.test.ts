import { createMonitor } from "@openstatus/db/src/test/factories";
import { afterEach, expect, mock, test } from "@openstatus/test-utils";

import { app } from "@/index";

import { TriggerSchema } from "./schema";

const mockFetch = mock();

global.fetch = mockFetch as unknown as typeof fetch;

afterEach(() => {
  mockFetch.mockReset();
});

test("trigger monitor with valid id should return 200", async () => {
  mockFetch.mockReturnValue(
    Promise.resolve(
      new Response(
        JSON.stringify({
          jobType: "http",
          status: 200,
          latency: 100,
          region: "ams",
          timestamp: 1234567890,
          timing: {
            dnsStart: 1,
            dnsDone: 2,
            connectStart: 3,
            connectDone: 4,
            tlsHandshakeStart: 5,
            tlsHandshakeDone: 6,
            firstByteStart: 7,
            firstByteDone: 8,
            transferStart: 9,
            transferDone: 10,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ),
  );

  const res = await app.request("/v1/monitor/1/trigger", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(200);

  const json = await res.json();
  const result = TriggerSchema.safeParse(json);
  expect(result.success).toBe(true);
  expect(json.resultId).toBeDefined();
  expect(typeof json.resultId).toBe("number");
});

test("trigger monitor with invalid id should return 404", async () => {
  const res = await app.request("/v1/monitor/999999/trigger", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(404);
});

test("trigger monitor without auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/1/trigger", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});

test("trigger monitor from different workspace should return 404", async () => {
  // Monitor 5 belongs to workspace 3, API key 1 is workspace 1
  const res = await app.request("/v1/monitor/5/trigger", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
  });
  expect(res.status).toBe(404);
});

// TODO: fix this test create a monitor, delete it, then trigger it
test.skip("trigger deleted monitor should return 404", async () => {
  const res = await app.request("/v1/monitor/3/trigger", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(404);
});

test("trigger TCP monitor with valid id should return 200", async () => {
  mockFetch.mockReturnValue(
    Promise.resolve(
      new Response(
        JSON.stringify({
          jobType: "tcp",
          latency: 50,
          region: "ams",
          timestamp: 1234567890,
          timing: {
            tcpStart: 1,
            tcpDone: 2,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ),
  );

  const res = await app.request("/v1/monitor/4/trigger", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(200);

  const json = await res.json();
  const result = TriggerSchema.safeParse(json);
  expect(result.success).toBe(true);
  expect(json.resultId).toBeDefined();
  expect(typeof json.resultId).toBe("number");
});

test("trigger monitor with multiple regions should return result id", async () => {
  mockFetch.mockReturnValue(
    Promise.resolve(
      new Response(
        JSON.stringify({
          jobType: "http",
          status: 200,
          latency: 100,
          region: "ams",
          timestamp: 1234567890,
          timing: {
            dnsStart: 1,
            dnsDone: 2,
            connectStart: 3,
            connectDone: 4,
            tlsHandshakeStart: 5,
            tlsHandshakeDone: 6,
            firstByteStart: 7,
            firstByteDone: 8,
            transferStart: 9,
            transferDone: 10,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ),
  );

  const res = await app.request("/v1/monitor/1/trigger", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(200);

  const json = await res.json();
  const result = TriggerSchema.safeParse(json);
  expect(result.success).toBe(true);
  expect(json.resultId).toBeDefined();
});

test("trigger ICMP monitor dispatches to the icmp checker endpoint", async () => {
  const icmpMonitor = await createMonitor(1, {
    jobType: "icmp",
    url: "1.1.1.1",
    active: true,
    regions: "ams",
    periodicity: "10m",
  });

  mockFetch.mockReturnValue(
    Promise.resolve(new Response(null, { status: 200 })),
  );

  const res = await app.request(`/v1/monitor/${icmpMonitor.id}/trigger`, {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(200);

  const json = await res.json();
  expect(TriggerSchema.safeParse(json).success).toBe(true);

  const [url, init] = mockFetch.mock.calls[0];
  expect(String(url)).toContain("/checker/icmp?");
  expect(JSON.parse(String(init.body))).toMatchObject({
    uri: "1.1.1.1",
    monitorId: String(icmpMonitor.id),
  });
});

test("trigger DNS monitor dispatches to the dns checker endpoint", async () => {
  const dnsMonitor = await createMonitor(1, {
    jobType: "dns",
    url: "openstatus.dev",
    active: true,
    regions: "ams",
    periodicity: "10m",
  });

  mockFetch.mockReturnValue(
    Promise.resolve(new Response(null, { status: 200 })),
  );

  const res = await app.request(`/v1/monitor/${dnsMonitor.id}/trigger`, {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(200);

  const [url] = mockFetch.mock.calls[0];
  expect(String(url)).toContain("/checker/dns?");
});
