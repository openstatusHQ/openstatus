import type {
  Incident,
  Maintenance,
  PageComponent,
  StatusReport,
  StatusReportUpdate,
} from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { describe, it, test } from "@std/testing/bdd";

import {
  createImpactReport,
  createStatusData,
  dayStartUTC,
  hoursAfter,
} from "../../../test/timeline-fixtures";
import {
  type Event,
  type ImpactInterval,
  type StatusData,
  activeReportStatus,
  currentImpactByComponent,
  eventWorstImpact,
  fillStatusDataFor45Days,
  getEvents,
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

describe("fillStatusDataFor45Days", () => {
  it("should fill all 45 days", () => {
    const data: StatusData[] = [];
    const result = fillStatusDataFor45Days(data, "1");

    expect(result).toHaveLength(45);
  });

  it("should fill exactly 30 days when lookbackPeriod is 30", () => {
    const result = fillStatusDataFor45Days([], "1", 30);

    expect(result).toHaveLength(30);
  });

  it("should sort data by day oldest first", () => {
    const data: StatusData[] = [];
    const result = fillStatusDataFor45Days(data, "1");

    for (let i = 1; i < result.length; i++) {
      const prev = new Date(result[i - 1].day);
      const curr = new Date(result[i].day);
      expect(curr.getTime()).toBeGreaterThan(prev.getTime());
    }
  });

  it("should preserve existing data", () => {
    const existingData = [createStatusData(5, 100, 50, 10)];
    const result = fillStatusDataFor45Days(existingData, "1");

    expect(result).toHaveLength(45);
    const matchingDay = result.find(
      (d) => d.ok === 100 && d.degraded === 50 && d.error === 10,
    );
    expect(matchingDay).toBeDefined();
  });

  it("should fill missing days with zeros", () => {
    const existingData = [createStatusData(5, 100, 0, 0)];
    const result = fillStatusDataFor45Days(existingData, "1");

    const emptyDays = result.filter((d) => d.count === 0);
    expect(emptyDays.length).toBe(44);
  });
});

describe("getEvents - pageComponent filtering", () => {
  // Helper to create a mock page component
  function createMockPageComponent(
    id: number,
    monitorId?: number,
  ): PageComponent {
    return {
      id,
      workspaceId: 1,
      pageId: 1,
      type: monitorId ? ("monitor" as const) : ("static" as const),
      monitorId: monitorId ?? null,
      name: `Component ${id}`,
      description: null,
      order: 0,
      groupId: null,
      groupOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // Helper to create a mock maintenance
  function createMockMaintenance(
    id: number,
    pageComponentIds: number[],
  ): Maintenance & {
    maintenancesToPageComponents: {
      pageComponent: PageComponent | null;
    }[];
  } {
    const now = new Date();
    const from = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
    const to = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour from now

    return {
      id,
      title: `Maintenance ${id}`,
      message: "Test maintenance",
      from,
      to,
      workspaceId: 1,
      pageId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      maintenancesToPageComponents: pageComponentIds.map((pcId) => ({
        pageComponent: createMockPageComponent(pcId, pcId * 10),
      })),
    };
  }

  // Helper to create a mock status report
  function createMockStatusReport(
    id: number,
    pageComponentIds: number[],
    status: "investigating" | "resolved" = "investigating",
  ): StatusReport & {
    statusReportsToPageComponents: {
      pageComponent: PageComponent | null;
    }[];
    statusReportUpdates: StatusReportUpdate[];
  } {
    const now = new Date();
    const updateDate = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago

    return {
      id,
      title: `Status Report ${id}`,
      status,
      workspaceId: 1,
      pageId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      statusReportsToPageComponents: pageComponentIds.map((pcId) => ({
        pageComponent: createMockPageComponent(pcId, pcId * 10),
      })),
      statusReportUpdates: [
        {
          id: id * 100,
          statusReportId: id,
          date: updateDate,
          status: "investigating",
          message: "Investigating the issue",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };
  }

  // Helper to create a mock incident
  function createMockIncident(id: number, monitorId: number): Incident {
    const now = new Date();
    const startedAt = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago

    return {
      id,
      title: `Incident ${id}`,
      summary: "Test incident",
      status: "investigating",
      monitorId,
      workspaceId: 1,
      startedAt,
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      incidentScreenshotUrl: null,
      recoveryScreenshotUrl: null,
      autoResolved: false,
      createdAt: startedAt,
      updatedAt: new Date(),
    };
  }

  it("should filter maintenances by pageComponentId", () => {
    const maintenances = [
      createMockMaintenance(1, [1, 2]),
      createMockMaintenance(2, [3, 4]),
      createMockMaintenance(3, [1, 5]),
    ];

    const events = getEvents({
      maintenances,
      incidents: [],
      reports: [],
      pageComponentId: 1,
      pastDays: 365,
    });

    const maintenanceEvents = events.filter((e) => e.type === "maintenance");
    expect(maintenanceEvents).toHaveLength(2);
    expect(maintenanceEvents.map((e) => e.id).sort()).toEqual([1, 3]);
  });

  it("should filter status reports by pageComponentId", () => {
    const reports = [
      createMockStatusReport(1, [1, 2]),
      createMockStatusReport(2, [3, 4]),
      createMockStatusReport(3, [1, 5]),
    ];

    const events = getEvents({
      maintenances: [],
      incidents: [],
      reports,
      pageComponentId: 1,
      pastDays: 365,
    });

    const reportEvents = events.filter((e) => e.type === "report");
    expect(reportEvents).toHaveLength(2);
    expect(reportEvents.map((e) => e.id).sort()).toEqual([1, 3]);
  });

  it("should exclude incidents for static components", () => {
    const incidents = [createMockIncident(1, 10), createMockIncident(2, 20)];

    const events = getEvents({
      maintenances: [],
      incidents,
      reports: [],
      componentType: "static",
      pastDays: 365,
    });

    const incidentEvents = events.filter((e) => e.type === "incident");
    expect(incidentEvents).toHaveLength(0);
  });

  it("should include incidents for monitor components", () => {
    const incidents = [createMockIncident(1, 10), createMockIncident(2, 20)];

    const events = getEvents({
      maintenances: [],
      incidents,
      reports: [],
      monitorId: 10,
      componentType: "monitor",
      pastDays: 365,
    });

    const incidentEvents = events.filter((e) => e.type === "incident");
    expect(incidentEvents).toHaveLength(1);
    expect(incidentEvents[0].id).toBe(1);
  });

  it("should maintain backward compatibility with monitorId filtering", () => {
    const maintenances = [
      createMockMaintenance(1, [1]),
      createMockMaintenance(2, [2]),
    ];

    const events = getEvents({
      maintenances,
      incidents: [],
      reports: [],
      monitorId: 10,
      pastDays: 365,
    });

    const maintenanceEvents = events.filter((e) => e.type === "maintenance");
    expect(maintenanceEvents).toHaveLength(1);
    expect(maintenanceEvents[0].id).toBe(1);
  });

  it("should prioritize pageComponentId over monitorId", () => {
    const maintenances = [
      createMockMaintenance(1, [1]),
      createMockMaintenance(2, [2]),
    ];

    const events = getEvents({
      maintenances,
      incidents: [],
      reports: [],
      pageComponentId: 1,
      monitorId: 20,
      pastDays: 365,
    });

    const maintenanceEvents = events.filter((e) => e.type === "maintenance");
    expect(maintenanceEvents).toHaveLength(1);
    expect(maintenanceEvents[0].id).toBe(1);
  });

  it("should return success status for resolved reports", () => {
    const reports = [createMockStatusReport(1, [1], "resolved")];

    const events = getEvents({
      maintenances: [],
      incidents: [],
      reports,
      pageComponentId: 1,
      pastDays: 365,
    });

    const reportEvents = events.filter((e) => e.type === "report");
    expect(reportEvents).toHaveLength(1);
    expect(reportEvents[0].status).toBe("success");
  });

  it("should return degraded status for unresolved reports", () => {
    const reports = [createMockStatusReport(1, [1], "investigating")];

    const events = getEvents({
      maintenances: [],
      incidents: [],
      reports,
      pageComponentId: 1,
      pastDays: 365,
    });

    const reportEvents = events.filter((e) => e.type === "report");
    expect(reportEvents).toHaveLength(1);
    expect(reportEvents[0].status).toBe("degraded");
  });
});

describe("componentImpacts", () => {
  describe("getEvents - impact projection", () => {
    const day = dayStartUTC(1);

    it("projects the filtered component's own timeline and status", () => {
      const report = createImpactReport({
        id: 1,
        components: [1, 2],
        updates: [
          {
            id: 100,
            date: day,
            status: "investigating",
            impacts: [
              { pageComponentId: 1, impact: "major_outage" },
              { pageComponentId: 2, impact: "degraded_performance" },
            ],
          },
        ],
      });

      const apiEvents = getEvents({
        maintenances: [],
        incidents: [],
        reports: [report],
        pageComponentId: 1,
      });
      expect(apiEvents).toHaveLength(1);
      expect(apiEvents[0].status).toBe("error");
      expect(apiEvents[0].impactIntervals).toHaveLength(1);
      expect(apiEvents[0].impactIntervals?.[0].impact).toBe("major_outage");

      const webEvents = getEvents({
        maintenances: [],
        incidents: [],
        reports: [report],
        pageComponentId: 2,
      });
      expect(webEvents[0].status).toBe("degraded");
      expect(webEvents[0].impactIntervals?.[0].impact).toBe(
        "degraded_performance",
      );
    });

    it("page-level projection takes the worst impact across components", () => {
      const report = createImpactReport({
        id: 1,
        components: [1, 2],
        updates: [
          {
            id: 100,
            date: day,
            status: "investigating",
            impacts: [
              { pageComponentId: 1, impact: "major_outage" },
              { pageComponentId: 2, impact: "degraded_performance" },
            ],
          },
        ],
      });

      const events = getEvents({
        maintenances: [],
        incidents: [],
        reports: [report],
      });
      expect(events[0].status).toBe("error");
      expect(events[0].impactIntervals?.[0].impact).toBe("major_outage");
    });

    it("legacy reports carry no impactIntervals and stay degraded", () => {
      const report = createImpactReport({
        id: 1,
        components: [1],
        updates: [{ id: 100, date: day, status: "investigating" }],
      });

      const events = getEvents({
        maintenances: [],
        incidents: [],
        reports: [report],
        pageComponentId: 1,
      });
      expect(events[0].status).toBe("degraded");
      expect(events[0].impactIntervals).toBeUndefined();
    });

    it("an active report whose component recovered reads success", () => {
      const report = createImpactReport({
        id: 1,
        components: [1],
        updates: [
          {
            id: 100,
            date: day,
            status: "investigating",
            impacts: [{ pageComponentId: 1, impact: "partial_outage" }],
          },
          {
            id: 101,
            date: hoursAfter(day, 2),
            status: "identified",
            impacts: [{ pageComponentId: 1, impact: "operational" }],
          },
        ],
      });

      const events = getEvents({
        maintenances: [],
        incidents: [],
        reports: [report],
        pageComponentId: 1,
      });
      expect(events[0].status).toBe("success");
      // prior interval closed at the second update
      expect(events[0].impactIntervals?.[0].to?.getTime()).toBe(
        hoursAfter(day, 2).getTime(),
      );
    });

    it("clamps open intervals to the resolved event end", () => {
      const report = createImpactReport({
        id: 1,
        status: "resolved",
        components: [1],
        updates: [
          {
            id: 100,
            date: day,
            status: "investigating",
            impacts: [{ pageComponentId: 1, impact: "major_outage" }],
          },
          {
            id: 101,
            date: hoursAfter(day, 3),
            status: "resolved",
            impacts: [{ pageComponentId: 1, impact: "operational" }],
          },
        ],
      });

      const events = getEvents({
        maintenances: [],
        incidents: [],
        reports: [report],
        pageComponentId: 1,
      });
      expect(events[0].status).toBe("success");
      const intervals = events[0].impactIntervals ?? [];
      expect(intervals).toHaveLength(2);
      expect(intervals[0].impact).toBe("major_outage");
      expect(intervals[0].to?.getTime()).toBe(hoursAfter(day, 3).getTime());
      // trailing operational interval clamped to the event end, not open
      expect(intervals[1].to?.getTime()).toBe(hoursAfter(day, 3).getTime());
    });
  });

  describe("currentImpactByComponent", () => {
    const day = dayStartUTC(1);

    it("latest update naming a component wins; resolve clears", () => {
      const report = createImpactReport({
        id: 1,
        components: [1, 2],
        updates: [
          {
            id: 100,
            date: day,
            status: "investigating",
            impacts: [
              { pageComponentId: 1, impact: "major_outage" },
              { pageComponentId: 2, impact: "degraded_performance" },
            ],
          },
          {
            id: 101,
            date: hoursAfter(day, 1),
            status: "identified",
            impacts: [{ pageComponentId: 1, impact: "partial_outage" }],
          },
        ],
      });

      const current = currentImpactByComponent(report);
      expect(current.get(1)).toBe("partial_outage");
      expect(current.get(2)).toBe("degraded_performance");
    });

    it("returns an empty map for legacy reports", () => {
      const report = createImpactReport({
        id: 1,
        components: [1],
        updates: [{ id: 100, date: day, status: "investigating" }],
      });
      expect(currentImpactByComponent(report).size).toBe(0);
    });
  });
});
