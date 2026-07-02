import { describe, expect, test } from "bun:test";

import {
  type OverlayIncident,
  bucketIncidentsByUtcDay,
} from "./incident-events";

const NOW = new Date("2026-06-24T12:00:00.000Z");
const DAYS = 45; // window start = 2026-05-11

function bucket(incidents: OverlayIncident[]) {
  return bucketIncidentsByUtcDay(incidents, { days: DAYS, now: NOW });
}

function keys(incidents: OverlayIncident[]): string[] {
  return [...bucket(incidents).keys()].sort();
}

describe("bucketIncidentsByUtcDay", () => {
  test("single-day incident maps to one UTC day", () => {
    const inc: OverlayIncident = {
      id: "a",
      name: "Elevated error rate",
      impact: "critical",
      startedAt: "2026-06-23T16:19:00.000Z",
      createdAt: "2026-06-23T16:19:00.000Z",
      resolvedAt: "2026-06-23T18:44:00.000Z",
    };
    const map = bucket([inc]);
    expect([...map.keys()]).toEqual(["2026-06-23"]);
    const [event] = map.get("2026-06-23") ?? [];
    expect(event?.type).toBe("incident");
    expect(event?.to).not.toBeNull();
  });

  test("multi-day incident spans every overlapped UTC day", () => {
    const inc: OverlayIncident = {
      id: "b",
      name: "Long outage",
      startedAt: "2026-06-20T22:00:00.000Z",
      createdAt: "2026-06-20T22:00:00.000Z",
      resolvedAt: "2026-06-22T02:00:00.000Z",
    };
    expect(keys([inc])).toEqual(["2026-06-20", "2026-06-21", "2026-06-22"]);
  });

  test("ongoing incident spans through today with to=null", () => {
    const inc: OverlayIncident = {
      id: "c",
      name: "Still down",
      startedAt: "2026-06-23T10:00:00.000Z",
      createdAt: "2026-06-23T10:00:00.000Z",
      resolvedAt: null,
    };
    const map = bucket([inc]);
    expect([...map.keys()].sort()).toEqual(["2026-06-23", "2026-06-24"]);
    expect(map.get("2026-06-24")?.[0]?.to).toBeNull();
  });

  test("null startedAt falls back to createdAt for the start", () => {
    const inc: OverlayIncident = {
      id: "d",
      name: "No start time",
      createdAt: "2026-06-22T09:00:00.000Z",
      resolvedAt: "2026-06-22T10:00:00.000Z",
    };
    const map = bucket([inc]);
    expect([...map.keys()]).toEqual(["2026-06-22"]);
    expect(map.get("2026-06-22")?.[0]?.from?.toISOString()).toBe(
      "2026-06-22T09:00:00.000Z",
    );
  });

  test("clamps to the window but keeps the full span on from/to", () => {
    const inc: OverlayIncident = {
      id: "e",
      name: "Started before the window",
      startedAt: "2026-05-09T00:00:00.000Z",
      createdAt: "2026-05-09T00:00:00.000Z",
      resolvedAt: "2026-05-13T00:00:00.000Z",
    };
    const map = bucket([inc]);
    expect([...map.keys()].sort()).toEqual([
      "2026-05-11",
      "2026-05-12",
      "2026-05-13",
    ]);
    expect(map.get("2026-05-11")?.[0]?.from?.toISOString()).toBe(
      "2026-05-09T00:00:00.000Z",
    );
  });

  test("incident fully before the window produces no days", () => {
    const inc: OverlayIncident = {
      id: "f",
      name: "Ancient",
      startedAt: "2026-04-01T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
      resolvedAt: "2026-04-02T00:00:00.000Z",
    };
    expect(keys([inc])).toEqual([]);
  });

  test("resolvedAt before startedAt paints a single day", () => {
    const inc: OverlayIncident = {
      id: "g",
      name: "Bad timestamps",
      startedAt: "2026-06-23T10:00:00.000Z",
      createdAt: "2026-06-23T10:00:00.000Z",
      resolvedAt: "2026-06-23T09:00:00.000Z",
    };
    expect(keys([inc])).toEqual(["2026-06-23"]);
  });

  test("present-but-invalid resolvedAt is resolved, not ongoing", () => {
    const inc: OverlayIncident = {
      id: "j",
      name: "Bad resolvedAt",
      startedAt: "2026-06-23T10:00:00.000Z",
      createdAt: "2026-06-23T10:00:00.000Z",
      resolvedAt: "not-a-date",
    };
    const map = bucket([inc]);
    expect([...map.keys()]).toEqual(["2026-06-23"]);
    expect(map.get("2026-06-23")?.[0]?.to).not.toBeNull();
  });

  test("maintenance impact yields a maintenance event", () => {
    const inc: OverlayIncident = {
      id: "h",
      name: "Scheduled maintenance",
      impact: "maintenance",
      startedAt: "2026-06-23T10:00:00.000Z",
      createdAt: "2026-06-23T10:00:00.000Z",
      resolvedAt: "2026-06-23T11:00:00.000Z",
    };
    expect(bucket([inc]).get("2026-06-23")?.[0]?.type).toBe("maintenance");
  });

  test("carries shortlink onto each day event", () => {
    const inc: OverlayIncident = {
      id: "i",
      name: "Linked",
      shortlink: "https://stspg.io/abc",
      startedAt: "2026-06-23T10:00:00.000Z",
      createdAt: "2026-06-23T10:00:00.000Z",
      resolvedAt: "2026-06-23T11:00:00.000Z",
    };
    expect(bucket([inc]).get("2026-06-23")?.[0]?.shortlink).toBe(
      "https://stspg.io/abc",
    );
  });
});
