import { describe, expect, test } from "vitest";

import {
  incidentResponseTimes,
  monthlyResponseAverages,
} from "./managed-incidents.client";

const MIN = 60_000;
const declaredAt = new Date(2026, 10, 10, 12, 0);
const at = (minutes: number) => new Date(declaredAt.getTime() + minutes * MIN);

function incident(
  overrides: Partial<Parameters<typeof incidentResponseTimes>[0]> = {},
) {
  return {
    status: "open" as const,
    declaredAt,
    acknowledgedAt: null,
    mitigatedAt: null,
    resolvedAt: null,
    ...overrides,
  };
}

describe("incidentResponseTimes", () => {
  test("measures each step from the declare", () => {
    expect(
      incidentResponseTimes(
        incident({
          status: "resolved",
          acknowledgedAt: at(5),
          mitigatedAt: at(30),
          resolvedAt: at(90),
        }),
      ),
    ).toEqual({ acknowledge: 5 * MIN, mitigate: 30 * MIN, resolve: 90 * MIN });
  });

  test("an incident never acknowledged has an unknown time to acknowledge", () => {
    expect(incidentResponseTimes(incident()).acknowledge).toBeNull();
  });

  test("an incident resolved directly has an unknown time to mitigate", () => {
    const times = incidentResponseTimes(
      incident({ status: "resolved", resolvedAt: at(40) }),
    );
    expect(times.mitigate).toBeNull();
    expect(times.resolve).toBe(40 * MIN);
  });

  test("a reopened incident keeps a stale resolvedAt, which does not count", () => {
    expect(
      incidentResponseTimes(incident({ status: "open", resolvedAt: at(40) }))
        .resolve,
    ).toBeNull();
  });
});

describe("monthlyResponseAverages", () => {
  const now = new Date(2026, 10, 20);

  test("averages the month's incidents per step with the sample size", () => {
    const averages = monthlyResponseAverages(
      [
        incident({
          status: "resolved",
          acknowledgedAt: at(10),
          mitigatedAt: at(20),
          resolvedAt: at(60),
        }),
        incident({
          status: "mitigated",
          acknowledgedAt: at(20),
          mitigatedAt: at(40),
        }),
        incident(),
      ],
      now,
    );
    expect(averages).toEqual({
      acknowledge: { average: 15 * MIN, count: 2 },
      mitigate: { average: 30 * MIN, count: 2 },
      resolve: { average: 60 * MIN, count: 1 },
    });
  });

  test("leaves out canceled incidents and other months", () => {
    const averages = monthlyResponseAverages(
      [
        incident({ status: "canceled", acknowledgedAt: at(1) }),
        incident({
          declaredAt: new Date(2026, 9, 31, 23, 0),
          acknowledgedAt: new Date(2026, 9, 31, 23, 30),
        }),
      ],
      now,
    );
    expect(averages.acknowledge).toEqual({ average: null, count: 0 });
  });
});
