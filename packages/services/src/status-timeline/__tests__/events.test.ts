import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";
import { FakeTime } from "@std/testing/time";

import {
  activeReportStatus,
  type Event,
  eventWorstImpact,
  getEvents,
  getHighestPriorityStatus,
  getWorstVariant,
  type ImpactInterval,
  isDateWithinEvent,
  reportEventDayImpact,
  reportEventDayStatus,
  resolveDayStatus,
  type StatusData,
} from "../events";
import { durationDowntimeMs } from "../uptime";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 1,
    name: "event",
    from: day("2026-01-10"),
    to: null,
    type: "report",
    status: "error",
    ...overrides,
  };
}

function makeBucket(overrides: Partial<StatusData> = {}): StatusData {
  return {
    day: "2026-01-11T00:00:00.000Z",
    count: 1,
    ok: 1,
    degraded: 0,
    error: 0,
    monitorId: "1",
    ...overrides,
  };
}

describe("getEvents incident timestamps", () => {
  const now = Date.now();
  const incident = {
    id: 1,
    title: "",
    summary: "",
    status: "resolved" as const,
    monitorId: 1,
    workspaceId: 1,
    startedAt: new Date(now - 3_600_000),
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: new Date(now),
    resolvedBy: null,
    incidentScreenshotUrl: null,
    recoveryScreenshotUrl: null,
    autoResolved: true,
    createdAt: new Date(now - 1_800_000),
    updatedAt: new Date(now),
  };

  test("counts the full outage when persistence is delayed or undated", () => {
    for (const createdAt of [incident.createdAt, null]) {
      const events = getEvents({
        maintenances: [],
        incidents: [{ ...incident, createdAt }],
        reports: [],
        monitorId: 1,
      });

      expect(events[0]?.from).toEqual(incident.startedAt);
      expect(
        durationDowntimeMs(events, {
          start: now - 86_400_000,
          end: now,
          now,
        }),
      ).toBe(3_600_000);
    }
  });

  test("filters incidents resolved before the window even when persistence is recent", () => {
    const events = getEvents({
      maintenances: [],
      incidents: [
        {
          ...incident,
          startedAt: new Date(now - 47 * 86_400_000),
          resolvedAt: new Date(now - 46 * 86_400_000),
        },
      ],
      reports: [],
    });

    expect(events).toEqual([]);
  });
});

describe("getEvents lookback", () => {
  test("keeps overlapping intervals and clips incident downtime to the window", () => {
    const time = new FakeTime(day("2026-03-01"));
    try {
      const from = day("2025-12-01");
      const threshold = day("2026-01-15");
      const ends = [
        day("2026-03-02"),
        day("2026-02-01"),
        threshold,
        new Date(threshold.getTime() - 1),
      ];
      const events = getEvents({
        reports: [],
        maintenances: ends.map((to, id) => ({
          id,
          title: "Maintenance",
          message: "",
          from,
          to,
          workspaceId: 1,
          pageId: 1,
          createdAt: from,
          updatedAt: from,
          maintenancesToPageComponents: [],
        })),
        incidents: [null, ...ends].map((resolvedAt, id) => ({
          id,
          title: "Incident",
          summary: "",
          status: resolvedAt ? "resolved" : "investigating",
          monitorId: 1,
          workspaceId: 1,
          startedAt: from,
          acknowledgedAt: null,
          acknowledgedBy: null,
          resolvedAt,
          resolvedBy: null,
          incidentScreenshotUrl: null,
          recoveryScreenshotUrl: null,
          autoResolved: false,
          createdAt: from,
          updatedAt: from,
        })),
      });

      expect(
        events
          .filter((event) => event.type === "maintenance")
          .map((event) => event.id),
      ).toEqual([0, 1, 2]);
      expect(
        events
          .filter((event) => event.type === "incident")
          .map((event) => event.id),
      ).toEqual([0, 1, 2, 3]);
      expect(
        resolveDayStatus(
          makeBucket({ day: "2026-02-28T00:00:00.000Z" }),
          events,
        ).status,
      ).toBe("down");
      expect(
        durationDowntimeMs(events, {
          start: threshold.getTime(),
          end: time.now,
          now: time.now,
        }),
      ).toBe(3_888_000_000);
      expect(
        resolveDayStatus(
          makeBucket({ day: "2026-02-28T00:00:00.000Z" }),
          events.filter((event) => event.type === "maintenance"),
        ).status,
      ).toBe("maintenance");
    } finally {
      time.restore();
    }
  });
});

describe("getWorstVariant", () => {
  test("empty input is operational (success)", () => {
    expect(getWorstVariant([])).toBe("success");
  });

  test("picks the highest-priority status", () => {
    expect(getWorstVariant(["success", "info"])).toBe("info");
    expect(getWorstVariant(["info", "degraded"])).toBe("degraded");
    expect(getWorstVariant(["error", "degraded", "info"])).toBe("error");
  });

  test("empty ranks below success, so success wins", () => {
    expect(getWorstVariant(["empty"])).toBe("success");
  });
});

describe("getHighestPriorityStatus", () => {
  test("error beats everything", () => {
    expect(
      getHighestPriorityStatus(makeBucket({ error: 1, degraded: 5, ok: 9 })),
    ).toBe("error");
  });

  test("degraded beats ok", () => {
    expect(
      getHighestPriorityStatus(makeBucket({ error: 0, degraded: 2, ok: 9 })),
    ).toBe("degraded");
  });

  test("ok maps to success, all-zero maps to empty", () => {
    expect(
      getHighestPriorityStatus(makeBucket({ error: 0, degraded: 0, ok: 3 })),
    ).toBe("success");
    expect(
      getHighestPriorityStatus(makeBucket({ error: 0, degraded: 0, ok: 0 })),
    ).toBe("empty");
  });
});

describe("isDateWithinEvent", () => {
  const event = makeEvent({ from: day("2026-01-10"), to: day("2026-01-12") });

  test("a day inside the window matches, including both boundaries", () => {
    expect(isDateWithinEvent(day("2026-01-11"), event)).toBe(true);
    expect(isDateWithinEvent(day("2026-01-10"), event)).toBe(true);
    expect(isDateWithinEvent(day("2026-01-12"), event)).toBe(true);
  });

  test("days outside the window do not match", () => {
    expect(isDateWithinEvent(day("2026-01-09"), event)).toBe(false);
    expect(isDateWithinEvent(day("2026-01-13"), event)).toBe(false);
  });

  test("an open-ended event runs up to now", () => {
    const open = makeEvent({ from: day("2020-01-01"), to: null });
    expect(isDateWithinEvent(day("2021-01-01"), open)).toBe(true);
    expect(isDateWithinEvent(day("2019-01-01"), open)).toBe(false);
  });
});

describe("activeReportStatus", () => {
  test("returns error when an open report is in error", () => {
    expect(
      activeReportStatus([
        makeEvent({ type: "report", to: null, status: "error" }),
      ]),
    ).toBe("error");
  });

  test("non-success open reports (degraded/info) read as degraded", () => {
    expect(
      activeReportStatus([
        makeEvent({ type: "report", to: null, status: "degraded" }),
      ]),
    ).toBe("degraded");
    expect(
      activeReportStatus([
        makeEvent({ type: "report", to: null, status: "info" }),
      ]),
    ).toBe("degraded");
  });

  test("error wins over degraded regardless of order", () => {
    const events = [
      makeEvent({ id: 1, type: "report", to: null, status: "degraded" }),
      makeEvent({ id: 2, type: "report", to: null, status: "error" }),
    ];
    expect(activeReportStatus(events)).toBe("error");
  });

  test("ignores resolved reports, success reports, and non-report events", () => {
    expect(
      activeReportStatus([
        makeEvent({ type: "report", to: day("2026-02-01"), status: "error" }),
      ]),
    ).toBeUndefined();
    expect(
      activeReportStatus([
        makeEvent({ type: "report", to: null, status: "success" }),
      ]),
    ).toBeUndefined();
    expect(
      activeReportStatus([
        makeEvent({ type: "incident", to: null, status: "error" }),
      ]),
    ).toBeUndefined();
  });
});

describe("eventWorstImpact", () => {
  const interval = (impact: ImpactInterval["impact"]): ImpactInterval => ({
    from: day("2026-01-10"),
    to: day("2026-01-11"),
    impact,
  });

  test("returns the worst impact across intervals", () => {
    const event = makeEvent({
      impactIntervals: [
        interval("degraded_performance"),
        interval("partial_outage"),
      ],
    });
    expect(eventWorstImpact(event)).toBe("partial_outage");
  });

  test("undefined when there are no impact rows (legacy report)", () => {
    expect(
      eventWorstImpact(makeEvent({ impactIntervals: undefined })),
    ).toBeUndefined();
    expect(
      eventWorstImpact(makeEvent({ impactIntervals: [] })),
    ).toBeUndefined();
  });
});

describe("reportEventDayImpact", () => {
  test("returns the worst impact among intervals overlapping the day", () => {
    const event = makeEvent({
      impactIntervals: [
        {
          from: day("2026-01-10"),
          to: day("2026-01-12"),
          impact: "degraded_performance",
        },
        {
          from: day("2026-01-10"),
          to: day("2026-01-12"),
          impact: "major_outage",
        },
      ],
    });
    expect(reportEventDayImpact(event, day("2026-01-11"))).toBe("major_outage");
  });

  test("null when the event has no impact rows (legacy)", () => {
    expect(
      reportEventDayImpact(
        makeEvent({ impactIntervals: undefined }),
        day("2026-01-11"),
      ),
    ).toBeNull();
  });

  test("operational when impacts exist but none overlaps the day", () => {
    const event = makeEvent({
      impactIntervals: [
        {
          from: day("2026-01-10"),
          to: day("2026-01-11"),
          impact: "major_outage",
        },
      ],
    });
    expect(reportEventDayImpact(event, day("2026-01-20"))).toBe("operational");
  });
});

describe("reportEventDayStatus", () => {
  test("legacy events (no impact rows) stay degraded", () => {
    expect(
      reportEventDayStatus(
        makeEvent({ impactIntervals: undefined }),
        day("2026-01-11"),
      ),
    ).toBe("degraded");
  });

  test("projects the day impact onto the status palette", () => {
    const major = makeEvent({
      impactIntervals: [
        {
          from: day("2026-01-10"),
          to: day("2026-01-12"),
          impact: "major_outage",
        },
      ],
    });
    expect(reportEventDayStatus(major, day("2026-01-11"))).toBe("error");

    const noOverlap = makeEvent({
      impactIntervals: [
        {
          from: day("2026-01-10"),
          to: day("2026-01-11"),
          impact: "major_outage",
        },
      ],
    });
    expect(reportEventDayStatus(noOverlap, day("2026-01-20"))).toBe("success");
  });
});

describe("resolveDayStatus", () => {
  const onDay = (overrides: Partial<Event> = {}) =>
    makeEvent({ from: day("2026-01-11"), to: day("2026-01-11"), ...overrides });

  test("an incident on the day dominates as down", () => {
    const events = [onDay({ type: "incident", status: "error" })];
    expect(resolveDayStatus(makeBucket({ ok: 1 }), events).status).toBe("down");
  });

  test("a major-outage report on the day resolves to down", () => {
    const events = [
      onDay({
        type: "report",
        to: null,
        impactIntervals: [
          { from: day("2026-01-11"), to: null, impact: "major_outage" },
        ],
      }),
    ];
    expect(resolveDayStatus(makeBucket({ ok: 1 }), events).status).toBe("down");
  });

  test("a maintenance-only day reads as maintenance", () => {
    const events = [onDay({ type: "maintenance", status: "info" })];
    expect(resolveDayStatus(makeBucket({ ok: 1 }), events).status).toBe(
      "maintenance",
    );
  });

  test("with no events it falls back to the uptime bucket", () => {
    expect(resolveDayStatus(makeBucket({ error: 1, ok: 0 }), []).status).toBe(
      "down",
    );
    expect(
      resolveDayStatus(makeBucket({ degraded: 1, ok: 0 }), []).status,
    ).toBe("degraded");
    expect(resolveDayStatus(makeBucket({ ok: 1 }), []).status).toBe(
      "operational",
    );
    expect(resolveDayStatus(makeBucket({ ok: 0 }), []).status).toBe("empty");
  });
});
