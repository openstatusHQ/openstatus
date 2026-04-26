import { beforeAll, describe, expect, test } from "bun:test";
import { db, eq } from "@openstatus/db";
import { monitor, pageComponent } from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import type { ImportSummary } from "@openstatus/importers";
import { addLimitWarnings, clampPeriodicity, computePhaseStatus } from "../";
import { withTestTransaction } from "../../../test/helpers";

function makeSummary(overrides?: Partial<ImportSummary>): ImportSummary {
  return {
    provider: "statuspage",
    status: "completed",
    startedAt: new Date(),
    completedAt: new Date(),
    phases: [],
    errors: [],
    ...overrides,
  };
}

function makeLimits(overrides?: Partial<Limits>): Limits {
  return { ...allPlans.free.limits, ...overrides };
}

// `addLimitWarnings` issues real `count(*)` queries against
// `pageComponent` and `monitor`. The expectations below assume an empty
// workspace, so wipe rows other suites' `beforeAll` blocks may have
// committed in workspace 2 once before any test runs. Per-test writes
// from this file all live inside `withTestTransaction` and roll back.
const TEST_WORKSPACE_ID = 2;

describe("addLimitWarnings", () => {
  beforeAll(async () => {
    await db
      .delete(pageComponent)
      .where(eq(pageComponent.workspaceId, TEST_WORKSPACE_ID));
    await db.delete(monitor).where(eq(monitor.workspaceId, TEST_WORKSPACE_ID));
  });

  // -------------------------------------------------------------------------
  // Component limits
  // -------------------------------------------------------------------------
  describe("component limits", () => {
    test("no warning when under limit", async () => {
      await withTestTransaction(async (tx) => {
        const summary = makeSummary({
          phases: [
            {
              phase: "components",
              status: "completed",
              resources: [
                { sourceId: "1", name: "A", status: "created" },
                { sourceId: "2", name: "B", status: "created" },
              ],
            },
          ],
        });

        await addLimitWarnings(summary, {
          limits: makeLimits({ "page-components": 20 }),
          workspaceId: 2,
          db: tx,
        });

        expect(summary.errors).toEqual([]);
      });
    });

    test("no warning when exactly at limit", async () => {
      await withTestTransaction(async (tx) => {
        const summary = makeSummary({
          phases: [
            {
              phase: "components",
              status: "completed",
              resources: [
                { sourceId: "1", name: "A", status: "created" },
                { sourceId: "2", name: "B", status: "created" },
                { sourceId: "3", name: "C", status: "created" },
              ],
            },
          ],
        });

        await addLimitWarnings(summary, {
          limits: makeLimits({ "page-components": 3 }),
          workspaceId: 2,
          db: tx,
        });

        expect(summary.errors).toEqual([]);
      });
    });

    test("warns when import exceeds limit (no existing components)", async () => {
      await withTestTransaction(async (tx) => {
        const summary = makeSummary({
          phases: [
            {
              phase: "components",
              status: "completed",
              resources: [
                { sourceId: "1", name: "A", status: "created" },
                { sourceId: "2", name: "B", status: "created" },
                { sourceId: "3", name: "C", status: "created" },
                { sourceId: "4", name: "D", status: "created" },
              ],
            },
          ],
        });

        await addLimitWarnings(summary, {
          limits: makeLimits({ "page-components": 3 }),
          workspaceId: 2,
          db: tx,
        });

        expect(summary.errors.length).toBe(1);
        // Wording: "Only 3 new components may be created … 4 in the import".
        // Both numbers land in the message — assert on the salient
        // fragments instead of the exact string so future phrasing tweaks
        // don't churn the assertion.
        expect(summary.errors[0]).toContain("3 new component");
        expect(summary.errors[0]).toContain("4 in the import");
      });
    });

    test("no warning when components phase is empty", async () => {
      await withTestTransaction(async (tx) => {
        const summary = makeSummary({
          phases: [{ phase: "components", status: "completed", resources: [] }],
        });

        await addLimitWarnings(summary, {
          limits: makeLimits({ "page-components": 3 }),
          workspaceId: 2,
          db: tx,
        });

        expect(summary.errors).toEqual([]);
      });
    });

    test("no warning when components phase is missing", async () => {
      await withTestTransaction(async (tx) => {
        const summary = makeSummary({
          phases: [{ phase: "page", status: "completed", resources: [] }],
        });

        await addLimitWarnings(summary, {
          limits: makeLimits({ "page-components": 3 }),
          workspaceId: 2,
          db: tx,
        });

        expect(summary.errors).toEqual([]);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Custom domain
  // -------------------------------------------------------------------------
  describe("custom domain", () => {
    test("warns when custom domain present on free plan", async () => {
      await withTestTransaction(async (tx) => {
        const summary = makeSummary({
          phases: [
            {
              phase: "page",
              status: "completed",
              resources: [
                {
                  sourceId: "p1",
                  name: "My Page",
                  status: "created",
                  data: { customDomain: "status.example.com" },
                },
              ],
            },
          ],
        });

        await addLimitWarnings(summary, {
          limits: makeLimits({ "custom-domain": false }),
          workspaceId: 2,
          db: tx,
        });

        expect(summary.errors.length).toBe(1);
        expect(summary.errors[0]).toContain("Custom domain");
      });
    });

    test("no warning when custom domain is empty", async () => {
      await withTestTransaction(async (tx) => {
        const summary = makeSummary({
          phases: [
            {
              phase: "page",
              status: "completed",
              resources: [
                {
                  sourceId: "p1",
                  name: "My Page",
                  status: "created",
                  data: { customDomain: "" },
                },
              ],
            },
          ],
        });

        await addLimitWarnings(summary, {
          limits: makeLimits({ "custom-domain": false }),
          workspaceId: 2,
          db: tx,
        });

        expect(summary.errors).toEqual([]);
      });
    });

    test("no warning on paid plan with custom domain", async () => {
      await withTestTransaction(async (tx) => {
        const summary = makeSummary({
          phases: [
            {
              phase: "page",
              status: "completed",
              resources: [
                {
                  sourceId: "p1",
                  name: "My Page",
                  status: "created",
                  data: { customDomain: "status.example.com" },
                },
              ],
            },
          ],
        });

        await addLimitWarnings(summary, {
          limits: makeLimits({ "custom-domain": true }),
          workspaceId: 2,
          db: tx,
        });

        expect(summary.errors).toEqual([]);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Subscribers
  // -------------------------------------------------------------------------
  describe("subscribers", () => {
    test("warns when subscribers present on free plan", async () => {
      await withTestTransaction(async (tx) => {
        const summary = makeSummary({
          phases: [
            {
              phase: "subscribers",
              status: "completed",
              resources: [
                { sourceId: "s1", name: "alice@test.com", status: "created" },
                { sourceId: "s2", name: "bob@test.com", status: "created" },
              ],
            },
          ],
        });

        // `addLimitWarnings` gates subscribers warnings on
        // `options.includeSubscribers` (Cubic P2 — otherwise users who
        // aren't importing subscribers get a noise warning). Default
        // matches `ImportOptions` (`false`), so the warning only fires
        // when the caller explicitly opts in. Tests that want to exercise
        // the warning pass `options.includeSubscribers: true`.
        await addLimitWarnings(summary, {
          limits: makeLimits({ "status-subscribers": false }),
          workspaceId: 2,
          db: tx,
          options: { includeSubscribers: true },
        });

        expect(summary.errors.length).toBe(1);
        expect(summary.errors[0]).toContain("Subscribers");
      });
    });

    test("no warning when subscribers phase is empty", async () => {
      await withTestTransaction(async (tx) => {
        const summary = makeSummary({
          phases: [
            { phase: "subscribers", status: "completed", resources: [] },
          ],
        });

        await addLimitWarnings(summary, {
          limits: makeLimits({ "status-subscribers": false }),
          workspaceId: 2,
          db: tx,
          options: { includeSubscribers: true },
        });

        expect(summary.errors).toEqual([]);
      });
    });

    test("no warning on paid plan with subscribers", async () => {
      await withTestTransaction(async (tx) => {
        const summary = makeSummary({
          phases: [
            {
              phase: "subscribers",
              status: "completed",
              resources: [
                { sourceId: "s1", name: "alice@test.com", status: "created" },
              ],
            },
          ],
        });

        await addLimitWarnings(summary, {
          limits: makeLimits({ "status-subscribers": true }),
          workspaceId: 2,
          db: tx,
          options: { includeSubscribers: true },
        });

        expect(summary.errors).toEqual([]);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Combined
  // -------------------------------------------------------------------------
  test("reports multiple warnings at once", async () => {
    await withTestTransaction(async (tx) => {
      const summary = makeSummary({
        phases: [
          {
            phase: "page",
            status: "completed",
            resources: [
              {
                sourceId: "p1",
                name: "Page",
                status: "created",
                data: { customDomain: "status.example.com" },
              },
            ],
          },
          {
            phase: "components",
            status: "completed",
            resources: [
              { sourceId: "1", name: "A", status: "created" },
              { sourceId: "2", name: "B", status: "created" },
              { sourceId: "3", name: "C", status: "created" },
              { sourceId: "4", name: "D", status: "created" },
            ],
          },
          {
            phase: "subscribers",
            status: "completed",
            resources: [
              { sourceId: "s1", name: "alice@test.com", status: "created" },
            ],
          },
        ],
      });

      // Free plan: page-components=3, custom-domain=false, status-subscribers=false
      // Opt in to subscribers so the subscribers-disallowed warning fires
      // (default `includeSubscribers` is `false` → warning silent).
      await addLimitWarnings(summary, {
        limits: makeLimits(),
        workspaceId: 2,
        db: tx,
        options: { includeSubscribers: true },
      });

      expect(summary.errors.length).toBe(3);
      expect(summary.errors.some((e) => e.includes("3 new component"))).toBe(
        true,
      );
      expect(summary.errors.some((e) => e.includes("Custom domain"))).toBe(
        true,
      );
      expect(summary.errors.some((e) => e.includes("Subscribers"))).toBe(true);
    });
  });

  test("no warnings on starter plan within limits", async () => {
    await withTestTransaction(async (tx) => {
      const summary = makeSummary({
        phases: [
          {
            phase: "page",
            status: "completed",
            resources: [
              {
                sourceId: "p1",
                name: "Page",
                status: "created",
                data: { customDomain: "status.example.com" },
              },
            ],
          },
          {
            phase: "components",
            status: "completed",
            resources: [
              { sourceId: "1", name: "A", status: "created" },
              { sourceId: "2", name: "B", status: "created" },
              { sourceId: "3", name: "C", status: "created" },
              { sourceId: "4", name: "D", status: "created" },
            ],
          },
          {
            phase: "subscribers",
            status: "completed",
            resources: [
              { sourceId: "s1", name: "alice@test.com", status: "created" },
            ],
          },
        ],
      });

      await addLimitWarnings(summary, {
        limits: { ...allPlans.starter.limits },
        workspaceId: 2,
        db: tx,
      });

      expect(summary.errors).toEqual([]);
    });
  });
});

describe("computePhaseStatus", () => {
  test("returns completed for empty resources", () => {
    expect(computePhaseStatus([])).toBe("completed");
  });

  test("returns completed when all resources are created", () => {
    expect(
      computePhaseStatus([
        { sourceId: "1", name: "A", status: "created" },
        { sourceId: "2", name: "B", status: "created" },
      ]),
    ).toBe("completed");
  });

  test("returns completed when all resources are skipped", () => {
    expect(
      computePhaseStatus([
        { sourceId: "1", name: "A", status: "skipped" },
        { sourceId: "2", name: "B", status: "skipped" },
      ]),
    ).toBe("completed");
  });

  test("returns partial when some resources are skipped", () => {
    expect(
      computePhaseStatus([
        { sourceId: "1", name: "A", status: "created" },
        { sourceId: "2", name: "B", status: "skipped" },
      ]),
    ).toBe("partial");
  });

  test("returns partial when some resources fail", () => {
    expect(
      computePhaseStatus([
        { sourceId: "1", name: "A", status: "created" },
        { sourceId: "2", name: "B", status: "failed" },
      ]),
    ).toBe("partial");
  });

  test("returns failed when all resources fail", () => {
    expect(
      computePhaseStatus([
        { sourceId: "1", name: "A", status: "failed" },
        { sourceId: "2", name: "B", status: "failed" },
      ]),
    ).toBe("failed");
  });
});

describe("clampPeriodicity", () => {
  const freePlan = allPlans.free.limits.periodicity as string[];
  const starterPlan = allPlans.starter.limits.periodicity as string[];

  describe("free plan", () => {
    test("allows 10m (already in plan)", () => {
      expect(clampPeriodicity("10m", freePlan)).toBe("10m");
    });

    test("allows 30m (already in plan)", () => {
      expect(clampPeriodicity("30m", freePlan)).toBe("30m");
    });

    test("allows 1h (already in plan)", () => {
      expect(clampPeriodicity("1h", freePlan)).toBe("1h");
    });

    test("clamps 1m to 10m", () => {
      expect(clampPeriodicity("1m", freePlan)).toBe("10m");
    });

    test("clamps 30s to 10m", () => {
      expect(clampPeriodicity("30s", freePlan)).toBe("10m");
    });

    test("clamps 5m to 10m", () => {
      expect(clampPeriodicity("5m", freePlan)).toBe("10m");
    });
  });

  describe("starter plan", () => {
    test("allows 1m (in plan)", () => {
      expect(clampPeriodicity("1m", starterPlan)).toBe("1m");
    });

    test("allows 5m (in plan)", () => {
      expect(clampPeriodicity("5m", starterPlan)).toBe("5m");
    });

    test("clamps 30s to 1m", () => {
      expect(clampPeriodicity("30s", starterPlan)).toBe("1m");
    });
  });

  describe("unknown requested periodicity", () => {
    // An unknown periodicity string (e.g. `"2m"` — not in
    // `PERIODICITY_ORDER`) previously clamped from index 0 (the
    // fastest tier), which could pick a *faster* interval than
    // requested. It should fall back to the slowest allowed instead,
    // erring toward the "never faster than requested" invariant.
    test("falls back to slowest allowed on unknown value", () => {
      expect(clampPeriodicity("2m", ["5m", "10m", "30m"])).toBe("30m");
    });

    test("falls back to 10m when `allowed` is empty", () => {
      expect(clampPeriodicity("2m", [])).toBe("10m");
    });
  });
});
