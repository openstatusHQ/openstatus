import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { hasIncidentActions } from "./incident-actions";

type Incident = Parameters<typeof hasIncidentActions>[0];

// safe because hasIncidentActions only reads status, closedAt and deletable
function incident(fields: {
  status: string;
  closedAt: Date | null;
  deletable: boolean;
}): Incident {
  return fields as unknown as Incident;
}

describe("hasIncidentActions", () => {
  it("offers closing a resolved, unclosed incident", () => {
    expect(
      hasIncidentActions(
        incident({ status: "resolved", closedAt: null, deletable: false }),
      ),
    ).toBe(true);
  });

  it("offers deleting a deletable incident", () => {
    expect(
      hasIncidentActions(
        incident({ status: "open", closedAt: null, deletable: true }),
      ),
    ).toBe(true);
  });

  it("offers nothing for an open or already closed incident", () => {
    expect(
      hasIncidentActions(
        incident({ status: "open", closedAt: null, deletable: false }),
      ),
    ).toBe(false);
    expect(
      hasIncidentActions(
        incident({
          status: "resolved",
          closedAt: new Date(),
          deletable: false,
        }),
      ),
    ).toBe(false);
  });
});
