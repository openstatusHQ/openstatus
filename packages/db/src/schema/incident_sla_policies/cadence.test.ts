import { describe, expect, it } from "vitest";

import {
  type IncidentUpdateActivity,
  type IncidentUpdateCadenceFields,
  incidentMissedUpdates,
  incidentUpdateCadence,
  isIncidentSystemEvent,
} from "./cadence";
import type { IncidentSlaSnapshot } from "./constants";

const declaredAt = new Date("2026-11-11T12:00:00.000Z");
const at = (minutes: number) =>
  new Date(declaredAt.getTime() + minutes * 60_000);

// critical: updates every 120m (warning at 90m); minor has no update target
const snapshot: IncidentSlaSnapshot = {
  targets: {
    critical: { responseMinutes: 60, updateMinutes: 120 },
    minor: { resolutionMinutes: 4320 },
  },
  resolutionStop: "mitigated",
};

const base: IncidentUpdateCadenceFields = {
  status: "open",
  severity: "critical",
  declaredAt,
  slaSnapshot: snapshot,
  resolutionStoppedAt: null,
  closedAt: null,
};

const none: IncidentUpdateActivity = {
  reportLinked: false,
  reportUpdatedAt: null,
  statusChangedAt: null,
  notedAt: null,
};

const cadence = (
  incident: Partial<IncidentUpdateCadenceFields>,
  activity: Partial<IncidentUpdateActivity>,
  now: Date,
) =>
  incidentUpdateCadence(
    { ...base, ...incident },
    { ...none, ...activity },
    now,
  );

describe("incidentUpdateCadence", () => {
  it("counts from declare without any update", () => {
    expect(cadence({}, {}, at(30))).toEqual({
      intervalMinutes: 120,
      startsAt: declaredAt,
      dueAt: at(120),
      warnAt: at(90),
      status: "running",
    });
  });

  it("is at risk in the last quarter and overdue after the due time", () => {
    expect(cadence({}, {}, at(90))?.status).toBe("at_risk");
    expect(cadence({}, {}, at(120))?.status).toBe("at_risk");
    expect(cadence({}, {}, at(121))?.status).toBe("overdue");
  });

  it("restarts at the newest note when no report is linked", () => {
    const result = cadence({}, { notedAt: at(100) }, at(130));
    expect(result?.startsAt).toEqual(at(100));
    expect(result?.dueAt).toEqual(at(220));
    expect(result?.status).toBe("running");
  });

  it("ignores notes once a report is linked and counts its newest update", () => {
    const result = cadence(
      {},
      { reportLinked: true, reportUpdatedAt: at(40), notedAt: at(100) },
      at(130),
    );
    expect(result?.startsAt).toEqual(at(40));
    expect(result?.dueAt).toEqual(at(160));
  });

  it("falls back to declare when the linked report has no update", () => {
    const result = cadence(
      {},
      { reportLinked: true, notedAt: at(100) },
      at(30),
    );
    expect(result?.startsAt).toEqual(declaredAt);
  });

  it("restarts at the newest status change", () => {
    const result = cadence(
      {
        status: "mitigated",
        slaSnapshot: { ...snapshot, resolutionStop: "resolved" },
      },
      { reportLinked: true, reportUpdatedAt: at(10), statusChangedAt: at(50) },
      at(60),
    );
    expect(result?.startsAt).toEqual(at(50));
  });

  it("a reopen after a report updated days ago starts a fresh interval", () => {
    const reopenedAt = at(5 * 1440);
    const result = cadence(
      {},
      {
        reportLinked: true,
        reportUpdatedAt: at(60),
        statusChangedAt: reopenedAt,
      },
      new Date(reopenedAt.getTime() + 10 * 60_000),
    );
    expect(result?.startsAt).toEqual(reopenedAt);
    expect(result?.status).toBe("running");
  });

  it("counts a backdated note at the time it carries", () => {
    expect(cadence({}, { notedAt: at(20) }, at(130))?.dueAt).toEqual(at(140));
  });

  it("never starts before declare", () => {
    expect(cadence({}, { notedAt: at(-30) }, at(10))?.startsAt).toEqual(
      declaredAt,
    );
  });

  it("is null without an update target, untracked, or once the clock stopped", () => {
    expect(cadence({ severity: "minor" }, {}, at(1))).toBeNull();
    expect(cadence({ severity: "major" }, {}, at(1))).toBeNull();
    expect(cadence({ slaSnapshot: null }, {}, at(1))).toBeNull();
    expect(
      cadence({ status: "mitigated", resolutionStoppedAt: at(30) }, {}, at(31)),
    ).toBeNull();
    expect(cadence({ status: "resolved" }, {}, at(31))).toBeNull();
    expect(cadence({ status: "canceled" }, {}, at(31))).toBeNull();
    expect(cadence({ closedAt: at(30) }, {}, at(31))).toBeNull();
  });

  it("keeps running while mitigated when the clock stops at resolved", () => {
    const result = cadence(
      {
        status: "mitigated",
        slaSnapshot: { ...snapshot, resolutionStop: "resolved" },
      },
      {},
      at(30),
    );
    expect(result?.dueAt).toEqual(at(120));
  });
});

describe("incidentMissedUpdates", () => {
  const running = (now: Date) => {
    const result = cadence({}, {}, now);
    if (!result) throw new Error("expected a cadence");
    return result;
  };

  it("is empty before the first due time passes", () => {
    expect(incidentMissedUpdates(running(at(120)), at(120))).toEqual([]);
  });

  it("lists every fully elapsed interval, oldest first", () => {
    expect(incidentMissedUpdates(running(at(370)), at(370))).toEqual([
      at(120),
      at(240),
      at(360),
    ]);
  });

  it("continues after a recorded due time, a bounded number at a time", () => {
    const now = at(1000);
    expect(
      incidentMissedUpdates(running(now), now, { after: at(240), limit: 2 }),
    ).toEqual([at(360), at(480)]);
    expect(
      incidentMissedUpdates(running(now), now, { after: at(840), limit: 5 }),
    ).toEqual([at(960)]);
  });
});

describe("isIncidentSystemEvent", () => {
  it("names the target and update misses, not human events", () => {
    expect(isIncidentSystemEvent("sla_response_breached")).toBe(true);
    expect(isIncidentSystemEvent("sla_resolution_breached")).toBe(true);
    expect(isIncidentSystemEvent("sla_update_missed")).toBe(true);
    expect(isIncidentSystemEvent("note")).toBe(false);
    expect(isIncidentSystemEvent("acknowledged")).toBe(false);
  });
});
