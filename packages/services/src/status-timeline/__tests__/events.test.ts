import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  type Event,
  type ImpactInterval,
  type StatusData,
  activeReportStatus,
  eventWorstImpact,
  getHighestPriorityStatus,
  getWorstVariant,
  isDateWithinEvent,
  reportEventDayImpact,
  reportEventDayStatus,
  resolveDayStatus,
} from "../events";

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
