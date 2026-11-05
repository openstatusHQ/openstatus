import { describe, expect, it } from "vitest";

import {
  HEARTBEAT_WINDOW_DAYS,
  downtimeSince,
  formatNextPing,
  getHeartbeatHealth,
  heartbeatExpectedAt,
  pingDays,
} from "./heartbeat.client";

const MINUTE = 60 * 1000;
const now = new Date("2026-11-05T12:00:00.000Z");
const at = (minutes: number) => new Date(now.getTime() + minutes * MINUTE);

const active = { active: true, status: "active" };
// hourly with 5m grace, last pinged 30m ago
const pinged = {
  lastPingAt: at(-30),
  lastPingKind: "success" as const,
  nextDueAt: at(35),
  grace: 300,
};

describe("getHeartbeatHealth", () => {
  it("is on time until the expected time passes", () => {
    expect(getHeartbeatHealth(active, pinged, now)).toBe("on-time");
  });

  it("is late inside the grace, before anything alerts", () => {
    const state = { ...pinged, lastPingAt: at(-62), nextDueAt: at(3) };
    expect(getHeartbeatHealth(active, state, now)).toBe("late");
  });

  it("is missed once the sweep marked the monitor down", () => {
    const state = { ...pinged, lastPingAt: at(-120), nextDueAt: at(-55) };
    expect(
      getHeartbeatHealth({ active: true, status: "error" }, state, now),
    ).toBe("missed");
  });

  it("is failed as soon as the job reports a failure", () => {
    const state = { ...pinged, lastPingKind: "fail" as const };
    expect(getHeartbeatHealth(active, state, now)).toBe("failed");
  });

  it("waits for the first ping and never alerts while paused", () => {
    const never = { ...pinged, lastPingAt: null, lastPingKind: null };
    expect(getHeartbeatHealth(active, never, now)).toBe("waiting");
    expect(
      getHeartbeatHealth({ active: false, status: "error" }, pinged, now),
    ).toBe("paused");
  });
});

describe("heartbeatExpectedAt", () => {
  it("takes the grace off the alert deadline", () => {
    expect(heartbeatExpectedAt(pinged)).toEqual(at(30));
    expect(heartbeatExpectedAt({ nextDueAt: null, grace: 300 })).toBeNull();
  });
});

describe("formatNextPing", () => {
  it("counts down, then counts how far behind", () => {
    expect(formatNextPing(at(12), now)).toBe("in 12m");
    expect(formatNextPing(at(-130), now)).toBe("2h 10m overdue");
  });
});

describe("pingDays", () => {
  it("zero-fills the window and keys rows by their UTC date", () => {
    const days = pingDays(
      [
        { day: "2026-11-05T00:00:00.000Z", ok: 3, error: 1 },
        { day: "2026-10-07T00:00:00.000Z", ok: 24, error: 0 },
        // outside the window
        { day: "2026-10-06T00:00:00.000Z", ok: 24, error: 0 },
      ],
      now,
    );
    expect(days).toHaveLength(HEARTBEAT_WINDOW_DAYS);
    expect(days.at(-1)).toMatchObject({ ok: 3, error: 1 });
    expect(days[0]).toMatchObject({ ok: 24, error: 0 });
    expect(days.reduce((sum, d) => sum + d.ok, 0)).toBe(27);
    // labelled with the UTC calendar date in any local timezone
    expect(new Date(days.at(-1)?.day ?? 0).getDate()).toBe(5);
    expect(new Date(days[0].day).getDate()).toBe(7);
  });
});

describe("downtimeSince", () => {
  it("clips to the window and runs an open incident until now", () => {
    const incidents = [
      { startedAt: at(-200), resolvedAt: at(-90) },
      { startedAt: at(-10), resolvedAt: null },
    ];
    expect(downtimeSince(incidents, at(-100), now)).toBe(20 * MINUTE);
    expect(downtimeSince([], at(-100), now)).toBe(0);
  });
});
