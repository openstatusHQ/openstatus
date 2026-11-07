import { describe, expect, test } from "vitest";

import { heartbeatPingUrl, pingHeartbeat } from "./heartbeat";

const URL = "https://api.openstatus.dev/heartbeat/abcdefghijklmnop";

describe("heartbeatPingUrl", () => {
  test("success pings the url, failure appends /fail", () => {
    expect(heartbeatPingUrl(URL, true)).toBe(URL);
    expect(heartbeatPingUrl(URL, false)).toBe(`${URL}/fail`);
    expect(heartbeatPingUrl(`${URL}/`, false)).toBe(`${URL}/fail`);
  });
});

describe("pingHeartbeat", () => {
  test("posts to the outcome url", async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const fake = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push([String(input), init]);
      return new Response("OK");
    }) as typeof fetch;
    await pingHeartbeat(URL, false, fake);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe(`${URL}/fail`);
    expect(calls[0]?.[1]?.method).toBe("POST");
  });

  test("swallows network errors and non-2xx responses", async () => {
    const throwing = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    const notFound = (async () =>
      new Response("Not Found", { status: 404 })) as typeof fetch;
    await expect(pingHeartbeat(URL, true, throwing)).resolves.toBeUndefined();
    await expect(pingHeartbeat(URL, true, notFound)).resolves.toBeUndefined();
  });
});
