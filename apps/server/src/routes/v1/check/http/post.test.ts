import { expect, test } from "bun:test";

import { afterEach, mock } from "bun:test";
import { app } from "@/index";

const mockFetch = mock();

global.fetch = mockFetch as unknown as typeof fetch;
mock.module("node-fetch", () => mockFetch);

afterEach(() => {
  mockFetch.mockReset();
});

test("Create a single check  ", async () => {
  const data = {
    url: "https://www.openstatus.dev",
    regions: ["ams"],
    method: "POST",
    body: '{"hello":"world"}',
    headers: [{ key: "key", value: "value" }],
  };
  mockFetch.mockReturnValue(
    Promise.resolve(
      new Response(
        '{"status":200,"latency":100,"body":"Hello World","headers":{"Content-Type":"application/json"},"timestamp":1234567890,"timing":{"dnsStart":1,"dnsDone":2,"connectStart":3,"connectDone":4,"tlsHandshakeStart":5,"tlsHandshakeDone":6,"firstByteStart":7,"firstByteDone":8,"transferStart":9,"transferDone":10},"region":"ams"}',
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    ),
  );

  const res = await app.request("/v1/check/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });

  expect(res.status).toBe(200);

  expect(await res.json()).toMatchObject({
    id: expect.any(Number),
    raw: [
      {
        connectDone: 4,
        connectStart: 3,
        dnsDone: 2,
        dnsStart: 1,
        firstByteDone: 8,
        firstByteStart: 7,
        tlsHandshakeDone: 6,
        tlsHandshakeStart: 5,
        transferDone: 10,
        transferStart: 9,
      },
    ],
    response: {
      body: "Hello World",
      headers: {
        "Content-Type": "application/json",
      },
      latency: 100,
      region: "ams",
      status: 200,
      timestamp: 1234567890,
      timing: {
        connectDone: 4,
        connectStart: 3,
        dnsDone: 2,
        dnsStart: 1,
        firstByteDone: 8,
        firstByteStart: 7,
        tlsHandshakeDone: 6,
        tlsHandshakeStart: 5,
        transferDone: 10,
        transferStart: 9,
      },
    },
  });
});

test("Create a multiple check", async () => {
  const data = {
    url: "https://www.openstatus.dev",
    regions: ["ams", "gru"],
    method: "POST",
    body: '{"hello":"world"}',
    headers: [{ key: "key", value: "value" }],
  };

  const amsResponse = {
    status: 200,
    latency: 100,
    body: "Hello from ams",
    headers: { "Content-Type": "application/json" },
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
    region: "ams",
  };

  const gruResponse = {
    status: 200,
    latency: 150,
    body: "Hello from gru",
    headers: { "Content-Type": "application/json" },
    timestamp: 1234567891,
    timing: {
      dnsStart: 11,
      dnsDone: 12,
      connectStart: 13,
      connectDone: 14,
      tlsHandshakeStart: 15,
      tlsHandshakeDone: 16,
      firstByteStart: 17,
      firstByteDone: 18,
      transferStart: 19,
      transferDone: 20,
    },
    region: "gru",
  };

  mockFetch
    .mockResolvedValueOnce(
      new Response(JSON.stringify(amsResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify(gruResponse), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

  const res = await app.request("/v1/check/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });

  expect(res.status).toBe(200);

  expect(await res.json()).toMatchObject({
    id: expect.any(Number),
    raw: [
      {
        connectDone: 4,
        connectStart: 3,
        dnsDone: 2,
        dnsStart: 1,
        firstByteDone: 8,
        firstByteStart: 7,
        tlsHandshakeDone: 6,
        tlsHandshakeStart: 5,
        transferDone: 10,
        transferStart: 9,
      },
      {
        connectDone: 14,
        connectStart: 13,
        dnsDone: 12,
        dnsStart: 11,
        firstByteDone: 18,
        firstByteStart: 17,
        tlsHandshakeDone: 16,
        tlsHandshakeStart: 15,
        transferDone: 20,
        transferStart: 19,
      },
    ],
    response: {
      body: "Hello from gru",
      headers: {
        "Content-Type": "application/json",
      },
      latency: 150,
      region: "gru",
      status: 200,
      timestamp: 1234567891,
      timing: {
        connectDone: 14,
        connectStart: 13,
        dnsDone: 12,
        dnsStart: 11,
        firstByteDone: 18,
        firstByteStart: 17,
        tlsHandshakeDone: 16,
        tlsHandshakeStart: 15,
        transferDone: 20,
        transferStart: 19,
      },
    },
  });
});