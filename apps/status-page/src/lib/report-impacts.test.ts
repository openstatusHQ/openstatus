import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

import { updatesWithImpactChanges } from "./report-impacts";

describe("updatesWithImpactChanges", () => {
  test("resolves component names and keeps update fields", () => {
    const result = updatesWithImpactChanges({
      statusReportsToPageComponents: [
        { pageComponent: { id: 1, name: "API" } },
        { pageComponent: { id: 2, name: "Dashboard" } },
      ],
      statusReportUpdates: [
        {
          id: 10,
          statusReportUpdateToPageComponents: [
            { pageComponentId: 2, impact: "major_outage" as const },
            { pageComponentId: 1, impact: "operational" as const },
          ],
        },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(10);
    expect(result[0].impactChanges).toEqual([
      { name: "Dashboard", impact: "major_outage" },
      { name: "API", impact: "operational" },
    ]);
  });

  test("falls back to the id for an unknown component", () => {
    const [update] = updatesWithImpactChanges({
      statusReportsToPageComponents: [],
      statusReportUpdates: [
        {
          statusReportUpdateToPageComponents: [
            { pageComponentId: 7, impact: "partial_outage" as const },
          ],
        },
      ],
    });
    expect(update.impactChanges).toEqual([
      { name: "#7", impact: "partial_outage" },
    ]);
  });

  test("returns an empty list without updates", () => {
    expect(
      updatesWithImpactChanges({
        statusReportsToPageComponents: [],
        statusReportUpdates: [],
      }),
    ).toEqual([]);
  });
});
