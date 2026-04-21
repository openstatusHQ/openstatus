import { describe, expect, test } from "bun:test";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import type { ImportSummary } from "@openstatus/importers";
import { addLimitWarnings, clampPeriodicity } from "./import";

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

describe("addLimitWarnings", () => {
  // -------------------------------------------------------------------------
  // Component limits
  // -------------------------------------------------------------------------
  describe("component limits", () => {
    test("no warning when under limit", async () => {
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
        workspaceId: 1,
      });

      expect(summary.errors).toEqual([]);
    });

    test("no warning when exactly at limit", async () => {
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
        workspaceId: 1,
      });

      expect(summary.errors).toEqual([]);
    });

    test("warns when import exceeds limit (no existing components)", async () => {
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
        workspaceId: 1,
      });

      expect(summary.errors.length).toBe(1);
      expect(summary.errors[0]).toContain("3 of 4");
    });

    test("no warning when components phase is empty", async () => {
      const summary = makeSummary({
        phases: [{ phase: "components", status: "completed", resources: [] }],
      });

      await addLimitWarnings(summary, {
        limits: makeLimits({ "page-components": 3 }),
        workspaceId: 1,
      });

      expect(summary.errors).toEqual([]);
    });

    test("no warning when components phase is missing", async () => {
      const summary = makeSummary({
        phases: [{ phase: "page", status: "completed", resources: [] }],
      });

      await addLimitWarnings(summary, {
        limits: makeLimits({ "page-components": 3 }),
        workspaceId: 1,
      });

      expect(summary.errors).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Custom domain
  // -------------------------------------------------------------------------
  describe("custom domain", () => {
    test("warns when custom domain present on free plan", async () => {
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
        workspaceId: 1,
      });

      expect(summary.errors.length).toBe(1);
      expect(summary.errors[0]).toContain("Custom domain");
    });

    test("no warning when custom domain is empty", async () => {
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
        workspaceId: 1,
      });

      expect(summary.errors).toEqual([]);
    });

    test("no warning on paid plan with custom domain", async () => {
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
        workspaceId: 1,
      });

      expect(summary.errors).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Subscribers
  // -------------------------------------------------------------------------
  describe("subscribers", () => {
    test("warns when subscribers present on free plan", async () => {
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

      await addLimitWarnings(summary, {
        limits: makeLimits({ "status-subscribers": false }),
        workspaceId: 1,
      });

      expect(summary.errors.length).toBe(1);
      expect(summary.errors[0]).toContain("Subscribers");
    });

    test("no warning when subscribers phase is empty", async () => {
      const summary = makeSummary({
        phases: [{ phase: "subscribers", status: "completed", resources: [] }],
      });

      await addLimitWarnings(summary, {
        limits: makeLimits({ "status-subscribers": false }),
        workspaceId: 1,
      });

      expect(summary.errors).toEqual([]);
    });

    test("no warning on paid plan with subscribers", async () => {
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
        workspaceId: 1,
      });

      expect(summary.errors).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Combined
  // -------------------------------------------------------------------------
  test("reports multiple warnings at once", async () => {
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
    await addLimitWarnings(summary, {
      limits: makeLimits(),
      workspaceId: 1,
    });

    expect(summary.errors.length).toBe(3);
    expect(summary.errors.some((e) => e.includes("3 of 4"))).toBe(true);
    expect(summary.errors.some((e) => e.includes("Custom domain"))).toBe(true);
    expect(summary.errors.some((e) => e.includes("Subscribers"))).toBe(true);
  });

  test("no warnings on starter plan within limits", async () => {
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
      workspaceId: 1,
    });

    expect(summary.errors).toEqual([]);
  });
});

describe("summary status semantics", () => {
  test("marks a phase partial when some resources are skipped", () => {
    const resources = [
      { sourceId: "1", name: "A", status: "created" as const },
      { sourceId: "2", name: "B", status: "skipped" as const },
    ];

    const status = resources.every((r) => r.status === "failed")
      ? "failed"
      : resources.some((r) => r.status === "failed") ||
          resources.some((r) => r.status === "skipped")
        ? "partial"
        : "completed";

    expect(status).toBe("partial");
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
});
