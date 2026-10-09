import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  type Timing,
  getTimingPhases,
  getTimingPhasesWidth,
  getTotalLatency,
  is32CharHex,
  isTimeoutError,
  latencyFormatter,
  regionCheckerSchemaResponse,
  regionFormatter,
  timestampFormatter,
} from "./utils";

const timing: Timing = {
  dnsStart: 0,
  dnsDone: 10,
  connectStart: 10,
  connectDone: 30,
  tlsHandshakeStart: 30,
  tlsHandshakeDone: 60,
  firstByteStart: 60,
  firstByteDone: 90,
  transferStart: 90,
  transferDone: 100,
};

describe("getTimingPhases", () => {
  test("computes each phase duration", () => {
    expect(getTimingPhases(timing)).toEqual({
      dns: 10,
      connection: 20,
      tls: 30,
      ttfb: 30,
      transfer: 10,
    });
  });

  test("sums phases into the total latency", () => {
    expect(getTotalLatency(timing)).toBe(100);
  });
});

describe("getTimingPhasesWidth", () => {
  test("lays phases end to end as percentages of the total", () => {
    expect(getTimingPhasesWidth(timing)).toEqual({
      dns: { preWidth: 0, width: 10 },
      connection: { preWidth: 10, width: 20 },
      tls: { preWidth: 30, width: 30 },
      ttfb: { preWidth: 60, width: 30 },
      transfer: { preWidth: 90, width: 10 },
    });
  });
});

describe("formatters", () => {
  test("latencyFormatter groups thousands and appends ms", () => {
    expect(latencyFormatter(1234)).toBe("1,234ms");
  });

  test("timestampFormatter renders GMT", () => {
    expect(timestampFormatter(Date.UTC(2024, 0, 2, 3, 4, 5))).toBe(
      "Tue, 02 Jan 2024 03:04:05 GMT",
    );
  });

  test("regionFormatter renders short and long forms", () => {
    expect(regionFormatter("ams")).toMatch(/^ams /);
    expect(regionFormatter("ams", "long")).toMatch(/^Amsterdam, Netherlands /);
  });
});

describe("is32CharHex", () => {
  test("accepts a dashless uuid", () => {
    expect(is32CharHex(crypto.randomUUID().replace(/-/g, ""))).toBe(true);
    expect(is32CharHex("AEC4E0EC3C4F4557B8CE46E55078FC95")).toBe(true);
  });

  test("rejects anything else", () => {
    expect(is32CharHex(crypto.randomUUID())).toBe(false);
    expect(is32CharHex("aec4e0ec3c4f4557b8ce46e55078fc9")).toBe(false);
    expect(is32CharHex("zec4e0ec3c4f4557b8ce46e55078fc95")).toBe(false);
  });
});

describe("isTimeoutError", () => {
  test("matches only errors named TimeoutError", () => {
    expect(isTimeoutError(new DOMException("t", "TimeoutError"))).toBe(true);
    expect(isTimeoutError(new DOMException("a", "AbortError"))).toBe(false);
    expect(isTimeoutError({ name: "TimeoutError" })).toBe(false);
  });
});

describe("regionCheckerSchemaResponse", () => {
  test("parses a success with defaults", () => {
    const parsed = regionCheckerSchemaResponse.parse({
      region: "ams",
      status: 200,
      latency: 100,
      headers: {},
      timestamp: 0,
      timing,
    });
    expect(parsed).toMatchObject({ state: "success", type: "http" });
  });

  test("parses an error response", () => {
    expect(
      regionCheckerSchemaResponse.parse({ region: "ams", message: "Timeout" }),
    ).toEqual({ region: "ams", message: "Timeout", state: "error" });
  });

  test("rejects an unknown region", () => {
    expect(
      regionCheckerSchemaResponse.safeParse({ region: "xxx", message: "x" })
        .success,
    ).toBe(false);
  });
});
