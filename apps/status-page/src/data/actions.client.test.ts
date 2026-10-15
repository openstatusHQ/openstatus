import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import * as incidents from "./incidents.client";
import * as maintenances from "./maintenances.client";
import * as monitors from "./monitors.client";
import * as regionMetrics from "./region-metrics.client";
import * as statusPages from "./status-pages.client";
import * as statusReportUpdates from "./status-report-updates.client";
import * as statusReports from "./status-reports.client";

type ActionModule = {
  actions: readonly { id: string; variant: string }[];
  getActions: (
    props: Record<string, () => void>,
  ) => { id: string; onClick?: () => void }[];
};

// safe because every module exports the same actions/getActions shape, keyed by its own ids
function asActionModule(mod: unknown): ActionModule {
  return mod as ActionModule;
}

const modules = {
  incidents,
  maintenances,
  monitors,
  regionMetrics,
  statusPages,
  statusReportUpdates,
  statusReports,
};

for (const [name, raw] of Object.entries(modules)) {
  const mod = asActionModule(raw);

  describe(`${name} actions`, () => {
    it("has unique ids", () => {
      const ids = mod.actions.map((a) => a.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("keeps destructive actions last", () => {
      const variants = mod.actions.map((a) => a.variant);
      const firstDestructive = variants.indexOf("destructive");
      if (firstDestructive === -1) return;
      expect(
        variants.slice(firstDestructive).every((v) => v === "destructive"),
      ).toBe(true);
    });

    it("wires each handler to its action and leaves the rest unset", () => {
      const [first, ...rest] = mod.actions;
      const handler = () => {};
      const result = mod.getActions({ [first.id]: handler });
      expect(result.map((a) => a.id)).toEqual(mod.actions.map((a) => a.id));
      expect(result[0].onClick).toBe(handler);
      for (const action of result.slice(1, rest.length + 1)) {
        expect(action.onClick).toBeUndefined();
      }
    });
  });
}
