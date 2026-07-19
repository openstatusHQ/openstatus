import type {
  Incident,
  Maintenance,
  StatusReport,
  StatusReportUpdate,
} from "@openstatus/db/src/schema";
import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { blacklistDates } from "./blacklist";
import { classNames, statusDetails } from "./config";
import { Tracker } from "./tracker";
import { Status } from "./types";

// Tracker's internal data shape (one bucket per day). Kept inline so these
// tests need no DB/env — mirrors the `{ day, count, ok }` rows in `mock.ts`.
function day(date: string, count: number, ok: number) {
  return { day: date, count, ok };
}

// Typed fixture factories (cast-free, complete objects + Partial overrides),
// matching the repo convention in packages/notifications/ms-teams.
type ReportWithUpdates = StatusReport & {
  statusReportUpdates?: StatusReportUpdate[];
};

function createIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 1,
    title: "",
    summary: "",
    status: "investigating",
    monitorId: 1,
    workspaceId: 1,
    startedAt: new Date("2024-01-01T00:00:00.000Z"),
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    resolvedBy: null,
    incidentScreenshotUrl: null,
    recoveryScreenshotUrl: null,
    autoResolved: false,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createMaintenance(overrides: Partial<Maintenance> = {}): Maintenance {
  return {
    id: 1,
    title: "Scheduled maintenance",
    message: "Maintenance window",
    from: new Date("2024-01-01T00:00:00.000Z"),
    to: new Date("2024-01-01T01:00:00.000Z"),
    workspaceId: 1,
    pageId: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createStatusReportUpdate(
  overrides: Partial<StatusReportUpdate> = {},
): StatusReportUpdate {
  return {
    id: 1,
    status: "investigating",
    date: new Date("2024-01-01T00:00:00.000Z"),
    message: "Looking into it",
    statusReportId: 1,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createStatusReport(
  overrides: Partial<ReportWithUpdates> = {},
): ReportWithUpdates {
  return {
    id: 1,
    status: "investigating",
    title: "Status report",
    workspaceId: 1,
    pageId: null,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

const HOUR = 60 * 60 * 1000;

describe("Tracker", () => {
  describe("totalUptime", () => {
    test("defaults to 100% when there is no data", () => {
      expect(new Tracker({}).totalUptime).toBe(100);
    });

    test("is 100% when every check is ok", () => {
      const tracker = new Tracker({ data: [day("2024-01-01", 864, 864)] });
      expect(tracker.totalUptime).toBe(100);
    });

    test("computes the ok/count ratio as a percentage", () => {
      const tracker = new Tracker({ data: [day("2024-01-01", 200, 150)] });
      expect(tracker.totalUptime).toBe(75);
    });

    test("rounds to two decimal places", () => {
      const tracker = new Tracker({ data: [day("2024-01-01", 3, 2)] });
      expect(tracker.totalUptime).toBe(66.67);
    });

    test("aggregates across multiple days", () => {
      const tracker = new Tracker({
        data: [day("2024-01-02", 100, 100), day("2024-01-01", 100, 0)],
      });
      expect(tracker.totalUptime).toBe(50);
    });
  });

  describe("isDataMissing", () => {
    test("is true with no data", () => {
      expect(new Tracker({}).isDataMissing).toBe(true);
    });

    test("is true when all buckets have a zero count", () => {
      const tracker = new Tracker({ data: [day("2024-01-01", 0, 0)] });
      expect(tracker.isDataMissing).toBe(true);
    });

    test("is false once there is at least one check", () => {
      const tracker = new Tracker({ data: [day("2024-01-01", 1, 1)] });
      expect(tracker.isDataMissing).toBe(false);
    });
  });

  describe("currentStatus: uptime thresholds", () => {
    const cases: Array<[string, number, number, Status]> = [
      ["100% → Operational", 100, 100, Status.Operational],
      ["exactly 98% → Operational", 100, 98, Status.Operational],
      ["just below 98% → Degraded", 10_000, 9_799, Status.DegradedPerformance],
      ["exactly 60% → Degraded", 100, 60, Status.DegradedPerformance],
      ["just below 60% → Partial Outage", 10_000, 5_999, Status.PartialOutage],
      ["just above 30% → Partial Outage", 10_000, 3_001, Status.PartialOutage],
      ["0% → Major Outage", 100, 0, Status.MajorOutage],
    ];

    for (const [label, count, ok, expected] of cases) {
      test(label, () => {
        const tracker = new Tracker({ data: [day("2024-01-01", count, ok)] });
        expect(tracker.currentStatus).toBe(expected);
      });
    }

    // NOTE: the lower boundary is `> 30`, while the other two are `>=`. So
    // exactly 30% uptime is Major (not Partial) Outage. Pinning current
    // behavior — the asymmetry is worth confirming with maintainers.
    test("exactly 30% → Major Outage (boundary is `> 30`, not `>= 30`)", () => {
      const tracker = new Tracker({ data: [day("2024-01-01", 100, 30)] });
      expect(tracker.currentStatus).toBe(Status.MajorOutage);
    });
  });

  describe("currentStatus: precedence", () => {
    // currentStatus order: maintenance > report > incident > uptime.
    const downData = [day("2024-01-01", 100, 0)]; // uptime → Major Outage

    test("ongoing maintenance wins over report, incident, and uptime", () => {
      const now = Date.now();
      const tracker = new Tracker({
        data: downData,
        maintenances: [
          createMaintenance({
            from: new Date(now - HOUR),
            to: new Date(now + HOUR),
          }),
        ],
        statusReports: [createStatusReport({ status: "investigating" })],
        incidents: [createIncident({ resolvedAt: null })],
      });
      expect(tracker.currentStatus).toBe(Status.UnderMaintenance);
    });

    test("ongoing report wins over incident and uptime", () => {
      const tracker = new Tracker({
        data: downData,
        statusReports: [createStatusReport({ status: "investigating" })],
        incidents: [createIncident({ resolvedAt: null })],
      });
      expect(tracker.currentStatus).toBe(Status.DegradedPerformance);
    });

    test("ongoing incident wins over uptime", () => {
      const tracker = new Tracker({
        data: downData,
        incidents: [createIncident({ resolvedAt: null })],
      });
      expect(tracker.currentStatus).toBe(Status.Incident);
    });

    test("a 'monitoring' report is not treated as ongoing", () => {
      const tracker = new Tracker({
        data: downData,
        statusReports: [createStatusReport({ status: "monitoring" })],
        incidents: [createIncident({ resolvedAt: null })],
      });
      // report no longer ongoing → falls through to the ongoing incident
      expect(tracker.currentStatus).toBe(Status.Incident);
    });

    test("a 'resolved' report is not treated as ongoing", () => {
      const tracker = new Tracker({
        data: downData,
        statusReports: [createStatusReport({ status: "resolved" })],
        incidents: [createIncident({ resolvedAt: null })],
      });
      // report no longer ongoing → falls through to the ongoing incident
      expect(tracker.currentStatus).toBe(Status.Incident);
    });

    test("a resolved incident does not trigger Incident status", () => {
      const tracker = new Tracker({
        data: [day("2024-01-01", 100, 100)],
        incidents: [
          createIncident({ resolvedAt: new Date("2024-01-01T01:00:00.000Z") }),
        ],
      });
      expect(tracker.currentStatus).toBe(Status.Operational);
    });

    test("past and future maintenance windows are not ongoing", () => {
      const now = Date.now();
      const past = new Tracker({
        data: [day("2024-01-01", 100, 100)],
        maintenances: [
          createMaintenance({
            from: new Date(now - 2 * HOUR),
            to: new Date(now - HOUR),
          }),
        ],
      });
      const future = new Tracker({
        data: [day("2024-01-01", 100, 100)],
        maintenances: [
          createMaintenance({
            from: new Date(now + HOUR),
            to: new Date(now + 2 * HOUR),
          }),
        ],
      });
      expect(past.currentStatus).toBe(Status.Operational);
      expect(future.currentStatus).toBe(Status.Operational);
    });
  });

  describe("currentStatus: missing data", () => {
    // For an explicit zero-count bucket, currentStatus reports Operational
    // (uptime defaults to 100%) while the SAME tracker's `days` view reports
    // Unknown/"Missing" for that bucket. Pinning the inconsistency on identical
    // input; this is a question for maintainers, not a unilateral change.
    test("reports Operational for a zero-count bucket that `days` calls Unknown", () => {
      const tracker = new Tracker({ data: [day("2024-01-01", 0, 0)] });
      expect(tracker.isDataMissing).toBe(true);
      expect(tracker.currentStatus).toBe(Status.Operational);
      expect(tracker.days[0].status).toBe(Status.Unknown);
    });
  });

  describe("status presentation getters", () => {
    test("currentVariant / currentDetails / currentClassName align with config", () => {
      const tracker = new Tracker({ data: [day("2024-01-01", 100, 100)] });
      expect(tracker.currentStatus).toBe(Status.Operational);
      expect(tracker.currentVariant).toBe("up");
      expect(tracker.currentDetails).toEqual(statusDetails[Status.Operational]);
      expect(tracker.currentClassName).toBe(classNames.up);
    });

    test("toString is the short label of the current status", () => {
      const tracker = new Tracker({ data: [day("2024-01-01", 100, 0)] });
      expect(tracker.currentStatus).toBe(Status.MajorOutage);
      expect(tracker.toString).toBe(statusDetails[Status.MajorOutage].short);
    });

    test("getters reflect a non-operational status (under maintenance)", () => {
      const now = Date.now();
      const tracker = new Tracker({
        data: [day("2024-01-01", 100, 100)],
        maintenances: [
          createMaintenance({
            from: new Date(now - HOUR),
            to: new Date(now + HOUR),
          }),
        ],
      });
      expect(tracker.currentStatus).toBe(Status.UnderMaintenance);
      expect(tracker.currentVariant).toBe("maintenance");
      expect(tracker.currentDetails).toEqual(
        statusDetails[Status.UnderMaintenance],
      );
      expect(tracker.currentClassName).toBe(classNames.maintenance);
    });
  });

  describe("days", () => {
    test("maps an operational bucket with its label and variant", () => {
      const [bucket] = new Tracker({
        data: [day("2024-01-01", 864, 864)],
      }).days;
      expect(bucket.status).toBe(Status.Operational);
      expect(bucket.label).toBe(statusDetails[Status.Operational].short);
      expect(bucket.variant).toBe("up");
    });

    test("labels a zero-count bucket as Missing/Unknown", () => {
      const [bucket] = new Tracker({ data: [day("2024-01-01", 0, 0)] }).days;
      expect(bucket.status).toBe(Status.Unknown);
      expect(bucket.label).toBe("Missing");
    });

    test("annotates blacklisted dates with their reason", () => {
      const [bucket] = new Tracker({
        // 2023-10-18: documented Vercel→Fly migration gap (see blacklist.ts)
        data: [day("2023-10-18 00:00:00", 864, 864)],
      }).days;
      expect(bucket.blacklist).toBe(blacklistDates["Wed Oct 18 2023"]);
    });

    test("leaves non-blacklisted dates unannotated", () => {
      const [bucket] = new Tracker({
        data: [day("2024-01-01 00:00:00", 864, 864)],
      }).days;
      expect(bucket.blacklist).toBeUndefined();
    });

    describe("per-day precedence (maintenance > report > incident > uptime)", () => {
      const DAY = "2024-01-01";
      // date-only string so `new Date(day)` anchors to UTC midnight, matching
      // the UTC fixture dates below regardless of the runner's timezone.
      const okData = [day(DAY, 864, 864)];

      test("maintenance overlapping the day wins", () => {
        const [bucket] = new Tracker({
          data: okData,
          maintenances: [
            createMaintenance({
              from: new Date(`${DAY}T00:00:00.000Z`),
              to: new Date(`${DAY}T12:00:00.000Z`),
            }),
          ],
          statusReports: [
            createStatusReport({
              statusReportUpdates: [
                createStatusReportUpdate({
                  date: new Date(`${DAY}T06:00:00.000Z`),
                }),
              ],
            }),
          ],
          incidents: [
            createIncident({ startedAt: new Date(`${DAY}T03:00:00.000Z`) }),
          ],
        }).days;
        expect(bucket.status).toBe(Status.UnderMaintenance);
      });

      test("a report dated on the day wins over an incident", () => {
        const [bucket] = new Tracker({
          data: okData,
          statusReports: [
            createStatusReport({
              statusReportUpdates: [
                createStatusReportUpdate({
                  date: new Date(`${DAY}T06:00:00.000Z`),
                }),
              ],
            }),
          ],
          incidents: [
            createIncident({ startedAt: new Date(`${DAY}T03:00:00.000Z`) }),
          ],
        }).days;
        expect(bucket.status).toBe(Status.DegradedPerformance);
      });

      test("an incident on the day wins over uptime", () => {
        const [bucket] = new Tracker({
          data: okData,
          incidents: [
            createIncident({ startedAt: new Date(`${DAY}T03:00:00.000Z`) }),
          ],
        }).days;
        expect(bucket.status).toBe(Status.Incident);
      });

      test("an incident resolved on a previous day does not affect this bucket", () => {
        const [bucket] = new Tracker({
          data: [day("2024-01-02", 864, 864)],
          incidents: [
            createIncident({
              startedAt: new Date("2024-01-01T12:00:00.000Z"),
              resolvedAt: new Date("2024-01-01T13:00:00.000Z"),
            }),
          ],
        }).days;
        expect(bucket.status).toBe(Status.Operational);
      });
    });
  });
});
