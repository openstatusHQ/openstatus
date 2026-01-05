import { expect, test } from "bun:test";

import { afterEach, mock } from "bun:test";
import { app } from "@/index";
import { TriggerResult } from "../schema";

const mockFetch = mock();

global.fetch = mockFetch as unknown as typeof fetch;
mock.module("node-fetch", () => mockFetch);

afterEach(() => {
  mockFetch.mockReset();
});

test("run monitor with valid id should return 200", async () => {
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

  const res = await app.request("/v1/monitor/1/run", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(200);

  const json = await res.json();
  const result = TriggerResult.array().safeParse(json);
  expect(result.success).toBe(true);
});

test("run monitor with no-wait parameter should return empty array", async () => {
  const res = await app.request("/v1/monitor/1/run?no-wait=true", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(200);

  const json = await res.json();
  expect(json).toEqual([]);
});

test("run monitor with invalid id should return 404", async () => {
  const res = await app.request("/v1/monitor/999999/run", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(404);
});

test("run monitor without auth key should return 401", async () => {
  const res = await app.request("/v1/monitor/1/run", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(401);
});

test.todo(
  "run monitor from different workspace should return 404",
  async () => {
    const res = await app.request("/v1/monitor/2/run", {
      method: "POST",
      headers: {
        "x-openstatus-key": "1",
        "content-type": "application/json",
      },
    });

    expect(res.status).toBe(404);
  },
);

test("run TCP monitor with valid id should return 200", async () => {
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

  const res = await app.request("/v1/monitor/4/run", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
  });

  expect(res.status).toBe(200);

  const json = await res.json();
  const result = TriggerResult.array().safeParse(json);
  expect(result.success).toBe(true);
  if (result.success && result.data[0]) {
    expect(result.data[0].jobType).toBe("tcp");
  }
});

test.todo(
  "run monitor with multiple regions should return array of results",
  async () => {
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

    const res = await app.request("/v1/monitor/5/run", {
      method: "POST",
      headers: {
        "x-openstatus-key": "1",
        "content-type": "application/json",
      },
    });

    expect(res.status).toBe(200);

    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
  },
);
