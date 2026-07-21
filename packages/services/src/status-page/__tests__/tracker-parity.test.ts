import { expect } from "@std/expect";
import { describe, test } from "@std/testing/bdd";

// TEMPORARY: differential gate proving derivePageStatus reproduces
// Tracker.currentStatus before @openstatus/tracker is deleted. Remove this file
// together with the package.
// Imported by path so this throwaway gate doesn't add a package dependency.
import { Tracker } from "../../../../tracker/src/tracker";
import { derivePageStatus } from "../derive-status";

const HOUR = 60 * 60 * 1000;
const now = Date.now();

const MAINTENANCES = {
  none: [],
  ongoing: [{ from: new Date(now - HOUR), to: new Date(now + HOUR) }],
  past: [{ from: new Date(now - 2 * HOUR), to: new Date(now - HOUR) }],
  future: [{ from: new Date(now + HOUR), to: new Date(now + 2 * HOUR) }],
};

const REPORTS = {
  none: [],
  investigating: [{ status: "investigating" }],
  identified: [{ status: "identified" }],
  monitoring: [{ status: "monitoring" }],
  resolved: [{ status: "resolved" }],
};

const INCIDENTS = {
  none: [],
  ongoing: [{ resolvedAt: null }],
  resolved: [{ resolvedAt: new Date(now - HOUR) }],
};

describe("Tracker.currentStatus parity", () => {
  for (const [mKey, maintenances] of Object.entries(MAINTENANCES)) {
    for (const [rKey, statusReports] of Object.entries(REPORTS)) {
      for (const [iKey, incidents] of Object.entries(INCIDENTS)) {
        test(`maintenance=${mKey} report=${rKey} incident=${iKey}`, () => {
          // The public route constructs Tracker with no `data`, so the uptime
          // branch never participates — mirror that here.
          // fixtures carry only the fields both implementations read; the full
          // db row types are irrelevant to the precedence being compared
          const tracker = new Tracker({
            maintenances: maintenances as never,
            statusReports: statusReports as never,
            incidents: incidents as never,
          });

          expect(
            derivePageStatus({ maintenances, statusReports, incidents }),
          ).toBe(tracker.currentStatus as string);
        });
      }
    }
  }
});
