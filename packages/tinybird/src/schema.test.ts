import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { calculateTiming } from "./schema";

// Absolute epoch-ms timestamps, as emitted by the checker's httptrace hooks.
const base = 1_782_880_607_000;
const completeTiming = {
  dnsStart: base,
  dnsDone: base + 5,
  connectStart: base + 5,
  connectDone: base + 6,
  tlsHandshakeStart: base + 6,
  tlsHandshakeDone: base + 16,
  firstByteStart: base + 16,
  firstByteDone: base + 116,
  transferStart: base + 116,
  transferDone: base + 120,
};

describe("calculateTiming", () => {
  test("computes phase durations from complete timing", () => {
    expect(calculateTiming(completeTiming)).toEqual({
      dns: 5,
      connect: 1,
      tls: 10,
      ttfb: 100,
      transfer: 4,
    });
  });

  test("clamps phases whose end hook never fired to 0", () => {
    // timeout after connect: first byte never arrived
    const timing = {
      ...completeTiming,
      firstByteDone: 0,
      transferStart: 0,
      transferDone: 0,
    };

    expect(calculateTiming(timing)).toEqual({
      dns: 5,
      connect: 1,
      tls: 10,
      ttfb: 0,
      transfer: 0,
    });
  });

  test("clamps phases whose start hook never fired to 0", () => {
    const timing = { ...completeTiming, transferStart: 0 };

    expect(calculateTiming(timing)?.transfer).toBe(0);
  });

  test("never returns negative durations for unmeasured phases", () => {
    const timing = {
      dnsStart: 0,
      dnsDone: 0,
      connectStart: 0,
      connectDone: 0,
      tlsHandshakeStart: 0,
      tlsHandshakeDone: 0,
      firstByteStart: base,
      firstByteDone: 0,
      transferStart: 0,
      transferDone: 0,
    };

    for (const value of Object.values(calculateTiming(timing) ?? {})) {
      expect(value).toBe(0);
    }
  });
});
