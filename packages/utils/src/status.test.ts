import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { type PageUpdateStatus, statusLabel } from "./status";

describe("statusLabel", () => {
  const labels: Record<PageUpdateStatus, string> = {
    investigating: "Investigating",
    identified: "Identified",
    monitoring: "Monitoring",
    resolved: "Resolved",
    maintenance: "Planned Maintenance",
  };

  for (const [status, label] of Object.entries(labels)) {
    it(`labels ${status} as "${label}"`, () => {
      expect(statusLabel(status as PageUpdateStatus)).toBe(label);
    });
  }
});
