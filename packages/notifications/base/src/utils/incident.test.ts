import { describe, expect, it } from "bun:test";
import type { Incident } from "@openstatus/db/src/schema";
import { getIncidentDuration } from "./incident";

// Helper to create a partial incident object for testing
function createIncident(overrides: Partial<Incident>): Incident {
  return {
    id: 1,
    monitorId: 1,
    workspaceId: 1,
    startedAt: null,
    resolvedAt: null,
    autoResolved: false,
    acknowledgedAt: null,
    acknowledgedBy: null,
    ...overrides,
  } as Incident;
}

describe("getIncidentDuration", () => {
  it("returns null when incident.startedAt is missing", () => {
    const incident = createIncident({
      startedAt: null,
      resolvedAt: new Date("2026-01-22T12:00:00Z"),
    });
    expect(getIncidentDuration(incident)).toBe(null);
  });

  it("returns null when incident.resolvedAt is null (ongoing incident)", () => {
    const incident = createIncident({
      startedAt: new Date("2026-01-22T10:00:00Z"),
      resolvedAt: null,
    });
    expect(getIncidentDuration(incident)).toBe(null);
  });

  it("calculates correct duration for resolved incident", () => {
    // 2h 15m 30s = 8130000ms
    const incident = createIncident({
      startedAt: new Date("2026-01-22T10:00:00Z"),
      resolvedAt: new Date("2026-01-22T12:15:30Z"),
    });
    expect(getIncidentDuration(incident)).toBe("2h 15m 30s");
  });

  it("calculates duration with Date objects", () => {
    const incident = createIncident({
      startedAt: new Date("2026-01-22T10:00:00Z"),
      resolvedAt: new Date("2026-01-22T10:30:00Z"),
    });
    expect(getIncidentDuration(incident)).toBe("30m");
  });

  it("calculates duration with timestamp numbers", () => {
    // 5 minutes = 300000ms
    const startTime = new Date("2026-01-22T10:00:00Z").getTime();
    const endTime = new Date("2026-01-22T10:05:00Z").getTime();
    const incident = createIncident({
      startedAt: startTime as unknown as Date,
      resolvedAt: endTime as unknown as Date,
    });
    expect(getIncidentDuration(incident)).toBe("5m");
  });

  it("handles very short durations (less than a minute)", () => {
    const incident = createIncident({
      startedAt: new Date("2026-01-22T10:00:00Z"),
      resolvedAt: new Date("2026-01-22T10:00:45Z"),
    });
    expect(getIncidentDuration(incident)).toBe("45s");
  });

  it("handles very long durations (over a day)", () => {
    // 1 day, 2 hours = 26 hours = 93600000ms
    const incident = createIncident({
      startedAt: new Date("2026-01-21T10:00:00Z"),
      resolvedAt: new Date("2026-01-22T12:00:00Z"),
    });
    expect(getIncidentDuration(incident)).toBe("1d 2h");
  });

  it("handles same start and end time (0 duration)", () => {
    const timestamp = new Date("2026-01-22T10:00:00Z");
    const incident = createIncident({
      startedAt: timestamp,
      resolvedAt: timestamp,
    });
    expect(getIncidentDuration(incident)).toBe("0s");
  });

  it("returns null when resolvedAt is before startedAt (negative duration)", () => {
    const incident = createIncident({
      startedAt: new Date("2026-01-22T12:00:00Z"),
      resolvedAt: new Date("2026-01-22T10:00:00Z"),
    });
    expect(getIncidentDuration(incident)).toBe(null);
  });
});
