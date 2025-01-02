import { expect, test } from "bun:test";

import { afterEach, mock } from "bun:test";
import { app } from "@/index";

// @ts-expect-error - FIXME: requires a function...
const mockFetch = mock();

global.fetch = mockFetch;
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

test.todo("Create a multiple check  ", async () => {
  const data = {
    url: "https://www.openstatus.dev",
    regions: ["ams", "gru"],
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

  const res = await app.request("/v1/check", {
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
