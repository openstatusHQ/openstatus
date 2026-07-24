import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import {
  type DerivePageStatusInput,
  Status,
  derivePageStatus,
} from "../derive-status";

const HOUR = 60 * 60 * 1000;

function input(
  overrides: Partial<DerivePageStatusInput> = {},
): DerivePageStatusInput {
  return {
    maintenances: [],
    statusReports: [],
    incidents: [],
    ...overrides,
  };
}

const ongoingMaintenance = () => {
  const now = Date.now();
  return { from: new Date(now - HOUR), to: new Date(now + HOUR) };
};

describe("derivePageStatus: precedence", () => {
  // order: maintenance > report > incident > operational
  test("ongoing maintenance wins over report and incident", () => {
    expect(
      derivePageStatus(
        input({
          maintenances: [ongoingMaintenance()],
          statusReports: [{ status: "investigating" }],
          incidents: [{ resolvedAt: null }],
        }),
      ),
    ).toBe(Status.UnderMaintenance);
  });

  test("ongoing report wins over incident", () => {
    expect(
      derivePageStatus(
        input({
          statusReports: [{ status: "investigating" }],
          incidents: [{ resolvedAt: null }],
        }),
      ),
    ).toBe(Status.DegradedPerformance);
  });

  test("ongoing incident wins over operational", () => {
    expect(derivePageStatus(input({ incidents: [{ resolvedAt: null }] }))).toBe(
      Status.Incident,
    );
  });

  test("no events → operational", () => {
    expect(derivePageStatus(input())).toBe(Status.Operational);
  });
});

describe("derivePageStatus: report statuses", () => {
  // The public payload depends on "monitoring" NOT counting as ongoing. This
  // diverges from ACTIVE_REPORT_STATUSES in page/get-content.ts by design.
  test("a 'monitoring' report is not ongoing → falls through to incident", () => {
    expect(
      derivePageStatus(
        input({
          statusReports: [{ status: "monitoring" }],
          incidents: [{ resolvedAt: null }],
        }),
      ),
    ).toBe(Status.Incident);
  });

  test("a 'monitoring' report alone → operational", () => {
    expect(
      derivePageStatus(input({ statusReports: [{ status: "monitoring" }] })),
    ).toBe(Status.Operational);
  });

  test("a 'resolved' report is not ongoing → falls through to incident", () => {
    expect(
      derivePageStatus(
        input({
          statusReports: [{ status: "resolved" }],
          incidents: [{ resolvedAt: null }],
        }),
      ),
    ).toBe(Status.Incident);
  });

  test("an 'identified' report is ongoing", () => {
    expect(
      derivePageStatus(input({ statusReports: [{ status: "identified" }] })),
    ).toBe(Status.DegradedPerformance);
  });
});

describe("derivePageStatus: incidents", () => {
  test("a resolved incident does not trigger incident status", () => {
    expect(
      derivePageStatus(
        input({ incidents: [{ resolvedAt: new Date("2024-01-01") }] }),
      ),
    ).toBe(Status.Operational);
  });

  test("one unresolved incident among resolved ones still triggers", () => {
    expect(
      derivePageStatus(
        input({
          incidents: [
            { resolvedAt: new Date("2024-01-01") },
            { resolvedAt: null },
          ],
        }),
      ),
    ).toBe(Status.Incident);
  });
});

describe("derivePageStatus: maintenance windows", () => {
  const now = new Date("2024-06-01T12:00:00.000Z");

  test("past window is not ongoing", () => {
    expect(
      derivePageStatus(
        input({
          maintenances: [
            {
              from: new Date("2024-06-01T08:00:00.000Z"),
              to: new Date("2024-06-01T09:00:00.000Z"),
            },
          ],
          now,
        }),
      ),
    ).toBe(Status.Operational);
  });

  test("future window is not ongoing", () => {
    expect(
      derivePageStatus(
        input({
          maintenances: [
            {
              from: new Date("2024-06-01T15:00:00.000Z"),
              to: new Date("2024-06-01T16:00:00.000Z"),
            },
          ],
          now,
        }),
      ),
    ).toBe(Status.Operational);
  });

  // Tracker uses `from <= now && to >= now`, so touching either edge counts.
  test("window boundaries are inclusive", () => {
    const startsNow = derivePageStatus(
      input({
        maintenances: [{ from: now, to: new Date("2024-06-01T13:00:00.000Z") }],
        now,
      }),
    );
    const endsNow = derivePageStatus(
      input({
        maintenances: [{ from: new Date("2024-06-01T11:00:00.000Z"), to: now }],
        now,
      }),
    );
    expect(startsNow).toBe(Status.UnderMaintenance);
    expect(endsNow).toBe(Status.UnderMaintenance);
  });
});
