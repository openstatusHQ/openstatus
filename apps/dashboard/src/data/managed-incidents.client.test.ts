import { describe, expect, test } from "vitest";

import { incidentResponseTimes } from "./managed-incidents.client";

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
