import type { CheckResult } from "@openstatus/services/monitor";
import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { checkResultToResponseLog } from "./checks-table-adapter";

const timing = {
  dnsStart: 100,
  dnsDone: 110,
  connectStart: 110,
  connectDone: 130,
  tlsHandshakeStart: 0,
  tlsHandshakeDone: 0,
  firstByteStart: 130,
  firstByteDone: 180,
  transferStart: 180,
  transferDone: 185,
};

function success(status: number): CheckResult {
  return {
    state: "success",
    type: "http",
    region: "ams",
    status,
    latency: 85,
    timestamp: 1_700_000_000_000,
    timing,
    headers: { "content-type": "text/html" },
  };
}

describe("checkResultToResponseLog", () => {
  it("maps a successful check", () => {
    const row = checkResultToResponseLog(success(200), 42, "https://x.dev");
    expect(row).toMatchObject({
      id: "ams",
      region: "ams",
      statusCode: 200,
      latency: 85,
      requestStatus: "success",
      monitorId: "42",
      url: "https://x.dev",
      error: false,
      message: null,
      body: null,
      headers: { "content-type": "text/html" },
      timestamp: 1_700_000_000_000,
      cronTimestamp: 1_700_000_000_000,
      trigger: "api",
    });
  });

  it("derives phase durations and zeroes phases that never fired", () => {
    const row = checkResultToResponseLog(success(200), 1, "");
    expect(row.type === "http" && row.timing).toEqual({
      dns: 10,
      connect: 20,
      tls: 0,
      ttfb: 50,
      transfer: 5,
    });
  });

  for (const [status, expected] of [
    [100, "error"],
    [204, "success"],
    [301, "success"],
    [404, "error"],
    [503, "error"],
  ] as const) {
    it(`treats status ${status} as ${expected}`, () => {
      expect(
        checkResultToResponseLog(success(status), 1, "").requestStatus,
      ).toBe(expected);
    });
  }

  it("maps a failed check", () => {
    const row = checkResultToResponseLog(
      {
        state: "error",
        type: "http",
        region: "iad",
        message: "timeout",
        timestamp: 5,
      },
      7,
      "https://x.dev",
    );
    expect(row).toMatchObject({
      id: "iad",
      statusCode: 0,
      latency: 0,
      requestStatus: "error",
      error: true,
      message: "timeout",
      timing: null,
      monitorId: "7",
      timestamp: 5,
    });
  });
});
