import { describe, expect, it } from "vitest";

import {
  type Event,
  getUptime,
  setDataByType,
  type StatusData,
} from "./statusPage.utils";

function bucket(date: string, ok = 100): StatusData {
  return {
    day: `${date}T00:00:00.000Z`,
    count: ok,
    ok,
    degraded: 0,
    error: 0,
    monitorId: "1",
  };
}

function incident(from: string, to: string): Event {
  return {
    id: 1,
    name: "incident",
    from: new Date(from),
    to: new Date(to),
    type: "incident",
    status: "error",
  };
}

describe("setDataByType in a time zone", () => {
  // 01:00-01:30 in Tokyo on 2026-10-16, still 2026-10-15 in UTC
  const early = incident(
    "2026-10-15T16:00:00.000Z",
    "2026-10-15T16:30:00.000Z",
  );

  it("colors the bar of the zone's date", () => {
    const [tokyo] = setDataByType({
      events: [early],
      data: [bucket("2026-10-16")],
      cardType: "requests",
      barType: "dominant",
      timeZone: "Asia/Tokyo",
    });
    expect(tokyo.bar[0].status).toBe("error");

    const [utc] = setDataByType({
      events: [early],
      data: [bucket("2026-10-16")],
      cardType: "requests",
      barType: "dominant",
    });
    expect(utc.bar[0].status).toBe("success");
  });

  it("measures downtime against the 25 hours of the day summer time ends", () => {
    // 23:30-23:45 in Berlin on 2026-10-25, the day summer time ends
    const late = incident(
      "2026-10-25T22:30:00.000Z",
      "2026-10-25T22:45:00.000Z",
    );
    const [day] = setDataByType({
      events: [late],
      data: [bucket("2026-10-25")],
      cardType: "requests",
      barType: "absolute",
      timeZone: "Europe/Berlin",
    });
    const error = day.bar.find((segment) => segment.status === "error");
    expect(error?.height).toBeCloseTo((15 / (25 * 60)) * 100);
  });
});

describe("getUptime in a time zone", () => {
  // 00:00-02:24 in Tokyo on 2026-10-14: 10% of that day, still 2026-10-13 in UTC
  const morning = incident(
    "2026-10-13T15:00:00.000Z",
    "2026-10-13T17:24:00.000Z",
  );

  it("counts downtime inside the zone's days", () => {
    const uptime = (timeZone?: string) =>
      getUptime({
        data: [bucket("2026-10-14")],
        events: [morning],
        barType: "absolute",
        cardType: "duration",
        timeZone,
      });
    expect(uptime("Asia/Tokyo")).toBe("90%");
    expect(uptime()).toBe("100%");
  });
});
