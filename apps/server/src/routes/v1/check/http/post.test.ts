import { afterEach, expect, mock, test } from "@openstatus/test-utils";

import { app } from "@/index";

const mockFetch = mock();

global.fetch = mockFetch as unknown as typeof fetch;

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

for (const url of [
  "http://localhost:3000",
  "http://127.0.0.1/health",
  "http://192.168.1.10/",
  "http://169.254.169.254/latest/meta-data/",
]) {
  test(`rejects a check against ${url} without probing it`, async () => {
    const res = await app.request("/v1/check/http", {
      method: "POST",
      headers: {
        "x-openstatus-key": "1",
        "content-type": "application/json",
      },
      body: JSON.stringify({ url, regions: ["ams"], method: "GET" }),
    });

    expect(res.status).toBe(400);
    // Pin the reason so a schema change can't turn this into a passing
    // test that never reaches the guard.
    expect((await res.json()).message).toContain("private or internal");
    expect(mockFetch).not.toHaveBeenCalled();
  });
}

test("runCount x regions returns every timing and only the last response", async () => {
  const regions = ["ams", "gru", "iad"];
  const runCount = 5;
  const data = {
    url: "https://www.openstatus.dev",
    regions,
    method: "GET",
    runCount,
  };

  let call = 0;
  mockFetch.mockImplementation(() => {
    const region = regions[call % regions.length];
    const run = Math.floor(call / regions.length);
    call++;
    const base = run * 100 + (call % regions.length) * 10;
    // Fresh Response per call: a body can only be read once.
    return Promise.resolve(
      new Response(
        JSON.stringify({
          status: 200,
          latency: base + 1,
          body: `Hello from ${region} run ${run}`,
          headers: { "X-Region": region, "X-Run": String(run) },
          timestamp: 1234567890 + call,
          timing: {
            dnsStart: base + 1,
            dnsDone: base + 2,
            connectStart: base + 3,
            connectDone: base + 4,
            tlsHandshakeStart: base + 5,
            tlsHandshakeDone: base + 6,
            firstByteStart: base + 7,
            firstByteDone: base + 8,
            transferStart: base + 9,
            transferDone: base + 10,
          },
          region,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
  });

  const res = await app.request("/v1/check/http", {
    method: "POST",
    headers: {
      "x-openstatus-key": "1",
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });

  expect(res.status).toBe(200);
  expect(mockFetch).toHaveBeenCalledTimes(runCount * regions.length);

  const json = await res.json();
  expect(json.raw).toHaveLength(runCount * regions.length);
  expect(json.response).toMatchObject({
    region: "iad",
    body: "Hello from iad run 4",
    headers: { "X-Region": "iad", "X-Run": "4" },
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

test("a region whose probe fails is skipped without failing the check", async () => {
  const ok = (region: string) =>
    new Response(
      JSON.stringify({
        status: 200,
        latency: 5,
        body: `Hello from ${region}`,
        headers: {},
        timestamp: 1,
        region,
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
    );
  mockFetch.mockImplementation((url: string) =>
    url.endsWith("/ping/gru")
      ? Promise.reject(new Error("checker unreachable"))
      : Promise.resolve(ok("ams")),
  );

  const res = await app.request("/v1/check/http", {
    method: "POST",
    headers: { "x-openstatus-key": "1", "content-type": "application/json" },
    body: JSON.stringify({
      url: "https://www.openstatus.dev",
      regions: ["ams", "gru"],
      method: "GET",
    }),
  });

  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.raw).toHaveLength(1);
  expect(json.response).toMatchObject({
    region: "ams",
    body: "Hello from ams",
  });
});

test("a malformed probe response fails the check instead of returning partial data", async () => {
  mockFetch.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ nope: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    ),
  );

  const res = await app.request("/v1/check/http", {
    method: "POST",
    headers: { "x-openstatus-key": "1", "content-type": "application/json" },
    body: JSON.stringify({
      url: "https://www.openstatus.dev",
      regions: ["ams"],
      method: "GET",
    }),
  });

  expect(res.status).toBe(500);
});
