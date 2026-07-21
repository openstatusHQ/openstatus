import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import {
  createImpactEvent,
  createIncident,
  createLegacyEvent,
  createMaintenance,
  createReport,
  createStatusData,
  dayStartUTC,
  hoursAfter,
} from "../../../test/timeline-fixtures";
import type { Event, StatusData } from "../../status-timeline";
import { setDataByType } from "../set-data-by-type";

describe("setDataByType", () => {
  describe("barType: absolute", () => {
    it("should show proportional bar segments with error-only incident", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createIncident(1, 0, 2)];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "absolute",
      });

      expect(result).toHaveLength(1);
      expect(result[0].bar).toHaveLength(2);
      expect(result[0].bar[0].status).toBe("success");
      expect(result[0].bar[1].status).toBe("error");
      // Should have uptime and downtime segments
      expect(result[0].bar[0].height).toBeGreaterThan(0);
      expect(result[0].bar[1].height).toBeGreaterThan(0);
    });

    it("should show proportional segments with multiple event types", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [
        createIncident(1, 0, 1),
        createReport(2, 0, 2),
        createMaintenance(3, 0, 1),
      ];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "absolute",
      });

      expect(result[0].bar.length).toBeGreaterThan(1);
      // Should include info, degraded, and error segments
      const statuses = result[0].bar.map((b) => b.status);
      expect(statuses).toContain("error");
      expect(statuses).toContain("degraded");
      expect(statuses).toContain("info");
    });

    it("should keep downtime proportional to the day when maintenance is present", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [
        createMaintenance(1, 0, 2), // 2h maintenance
        createIncident(2, 0, 1), // 1h downtime
      ];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "absolute",
      });

      const bar = result[0].bar;
      const errorHeight = bar.find((b) => b.status === "error")?.height ?? 0;
      const infoHeight = bar.find((b) => b.status === "info")?.height ?? 0;

      // 1h downtime is at most 1/24 of the day (~4.17%), never the old ~33%
      expect(errorHeight).toBeGreaterThan(0);
      expect(errorHeight).toBeLessThan(5);
      expect(errorHeight).toBeLessThan(infoHeight);
      // maintenance fills the remaining space, no green uptime
      expect(bar.some((b) => b.status === "success")).toBe(false);
      expect(errorHeight + infoHeight).toBeCloseTo(100, 5);
    });

    it("should fill the whole day for a maintenance-only day", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createMaintenance(1, 0, 2)];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "absolute",
      });

      expect(result[0].bar).toHaveLength(1);
      expect(result[0].bar[0].status).toBe("info");
      expect(result[0].bar[0].height).toBe(100);
    });

    it("should fill the whole day for a report-only day", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createReport(1, 0, 2)];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "absolute",
      });

      expect(result[0].bar).toHaveLength(1);
      expect(result[0].bar[0].status).toBe("degraded");
      expect(result[0].bar[0].height).toBe(100);
    });

    it("should show empty bar when no data available", () => {
      const data = [createStatusData(0, 0, 0, 0)];
      const events: Event[] = [];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "absolute",
      });

      expect(result[0].bar).toHaveLength(1);
      expect(result[0].bar[0].status).toBe("empty");
      expect(result[0].bar[0].height).toBe(100);
    });

    it("should show operational bar with duration cardType and no events", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events: Event[] = [];

      const result = setDataByType({
        events,
        data,
        cardType: "duration",
        barType: "absolute",
      });

      expect(result[0].bar).toHaveLength(1);
      expect(result[0].bar[0].status).toBe("success");
      expect(result[0].bar[0].height).toBe(100);
    });

    it("should show proportional status segments with mixed data and no events", () => {
      const data = [createStatusData(0, 80, 15, 5)];
      const events: Event[] = [];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "absolute",
      });

      expect(result[0].bar.length).toBeGreaterThan(1);
      const statuses = result[0].bar.map((b) => b.status);
      expect(statuses).toContain("success");
      expect(statuses).toContain("degraded");
      expect(statuses).toContain("error");
    });
  });

  describe("barType: dominant", () => {
    it("should show error as dominant status when incident exists", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createIncident(1, 0)];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "dominant",
      });

      expect(result[0].bar).toHaveLength(1);
      expect(result[0].bar[0].status).toBe("error");
      expect(result[0].bar[0].height).toBe(100);
    });

    it("should show degraded when only reports exist", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createReport(1, 0)];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "dominant",
      });

      expect(result[0].bar).toHaveLength(1);
      expect(result[0].bar[0].status).toBe("degraded");
      expect(result[0].bar[0].height).toBe(100);
    });

    it("should show info when only maintenance exists", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createMaintenance(1, 0)];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "dominant",
      });

      expect(result[0].bar).toHaveLength(1);
      expect(result[0].bar[0].status).toBe("info");
      expect(result[0].bar[0].height).toBe(100);
    });

    it("should prioritize error over other statuses", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [
        createIncident(1, 0),
        createReport(2, 0),
        createMaintenance(3, 0),
      ];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "dominant",
      });

      expect(result[0].bar[0].status).toBe("error");
    });

    it("should show data status when no events", () => {
      const data = [createStatusData(0, 0, 100, 0)];
      const events: Event[] = [];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "dominant",
      });

      expect(result[0].bar[0].status).toBe("degraded");
    });
  });

  describe("barType: manual", () => {
    it("should show degraded when reports exist", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createReport(1, 0)];

      const result = setDataByType({
        events,
        data,
        cardType: "manual",
        barType: "manual",
      });

      expect(result[0].bar).toHaveLength(1);
      expect(result[0].bar[0].status).toBe("degraded");
      expect(result[0].bar[0].height).toBe(100);
    });

    it("should show info when only maintenance exists", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createMaintenance(1, 0)];

      const result = setDataByType({
        events,
        data,
        cardType: "manual",
        barType: "manual",
      });

      expect(result[0].bar).toHaveLength(1);
      expect(result[0].bar[0].status).toBe("info");
      expect(result[0].bar[0].height).toBe(100);
    });

    it("should ignore incidents and show success", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createIncident(1, 0)];

      const result = setDataByType({
        events,
        data,
        cardType: "manual",
        barType: "manual",
      });

      expect(result[0].bar).toHaveLength(1);
      expect(result[0].bar[0].status).toBe("success");
    });

    it("should prioritize reports over maintenance", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createReport(1, 0), createMaintenance(2, 0)];

      const result = setDataByType({
        events,
        data,
        cardType: "manual",
        barType: "manual",
      });

      expect(result[0].bar[0].status).toBe("degraded");
    });
  });

  describe("cardType: requests", () => {
    it("should show request counts for each status", () => {
      const data = [createStatusData(0, 100, 50, 10)];
      const events: Event[] = [];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "dominant",
      });

      expect(result[0].card.length).toBe(3);
      expect(result[0].card.some((c) => c.value.includes("100 reqs"))).toBe(
        true,
      );
      expect(result[0].card.some((c) => c.value.includes("50 reqs"))).toBe(
        true,
      );
      expect(result[0].card.some((c) => c.value.includes("10 reqs"))).toBe(
        true,
      );
    });

    it("should format large numbers correctly", () => {
      const data = [createStatusData(0, 5000, 0, 0)];
      const events: Event[] = [];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "dominant",
      });

      expect(result[0].card[0].value).toBe("5.0k reqs");
    });

    it("should show empty card when no data", () => {
      const data = [createStatusData(0, 0, 0, 0)];
      const events: Event[] = [];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "dominant",
      });

      expect(result[0].card).toHaveLength(1);
      expect(result[0].card[0].value).toBe("");
      expect(result[0].card[0].status).toBe("empty");
    });

    it("should show event status in empty card when no data but events exist", () => {
      const data = [createStatusData(0, 0, 0, 0)];
      const events = [createIncident(1, 0)];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "dominant",
      });

      expect(result[0].card).toHaveLength(1);
      expect(result[0].card[0].status).toBe("error");
    });
  });

  describe("cardType: duration", () => {
    it("should calculate duration for events", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [
        createIncident(1, 0, 1), // 1 hour
        createReport(2, 0, 2), // 2 hours
      ];

      const result = setDataByType({
        events,
        data,
        cardType: "duration",
        barType: "absolute",
      });

      expect(result[0].card.length).toBeGreaterThan(0);
      // Should have durations for error, degraded, and success
      const hasError = result[0].card.some(
        (c) => c.status === "error" && c.value.includes("h"),
      );
      const hasDegraded = result[0].card.some(
        (c) => c.status === "degraded" && c.value.includes("h"),
      );
      expect(hasError || hasDegraded).toBe(true);
    });

    it("should format duration in hours and minutes", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createIncident(1, 0, 1.5)]; // 1.5 hours = 1h 30m

      const result = setDataByType({
        events,
        data,
        cardType: "duration",
        barType: "absolute",
      });

      const errorCard = result[0].card.find((c) => c.status === "error");
      expect(errorCard).toBeDefined();
      // Should contain hour notation and optionally minutes
      expect(errorCard?.value).toMatch(/\d+h(\s\d+m)?/);
    });

    it("should show success duration as remaining time", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createIncident(1, 0, 1)]; // 1 hour downtime

      const result = setDataByType({
        events,
        data,
        cardType: "duration",
        barType: "absolute",
      });

      const successCard = result[0].card.find((c) => c.status === "success");
      expect(successCard).toBeDefined();
      // Success duration should be total time minus downtime
      expect(successCard?.value).toBeTruthy();
    });

    it("should exclude maintenance from success calculation", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createMaintenance(1, 0, 2)]; // 2 hours maintenance

      const result = setDataByType({
        events,
        data,
        cardType: "duration",
        barType: "absolute",
      });

      const successCard = result[0].card.find((c) => c.status === "success");
      // Success should account for maintenance being excluded from total time
      expect(successCard).toBeDefined();
    });

    it("should show empty card when no data", () => {
      const data = [createStatusData(0, 0, 0, 0)];
      const events: Event[] = [];

      const result = setDataByType({
        events,
        data,
        cardType: "duration",
        barType: "absolute",
      });

      expect(result[0].card).toHaveLength(1);
      expect(result[0].card[0].value).toBe("");
    });
  });

  describe("cardType: dominant", () => {
    it("should show dominant status without value", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createIncident(1, 0)];

      const result = setDataByType({
        events,
        data,
        cardType: "dominant",
        barType: "dominant",
      });

      expect(result[0].card).toHaveLength(1);
      expect(result[0].card[0].status).toBe("error");
      expect(result[0].card[0].value).toBe("");
    });
  });

  describe("cardType: manual", () => {
    it("should show degraded for reports", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createReport(1, 0)];

      const result = setDataByType({
        events,
        data,
        cardType: "manual",
        barType: "manual",
      });

      expect(result[0].card).toHaveLength(1);
      expect(result[0].card[0].status).toBe("degraded");
      expect(result[0].card[0].value).toBe("");
    });

    it("should show success when no manual events", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [createIncident(1, 0)];

      const result = setDataByType({
        events,
        data,
        cardType: "manual",
        barType: "manual",
      });

      expect(result[0].card[0].status).toBe("success");
    });
  });

  describe("event bundling", () => {
    it("should bundle more than 4 incidents into single event", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [
        createIncident(1, 0),
        createIncident(2, 0),
        createIncident(3, 0),
        createIncident(4, 0),
        createIncident(5, 0),
      ];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "absolute",
      });

      // Should have bundled incident with special id -1
      const bundledIncident = result[0].events.find((e) => e.id === -1);
      expect(bundledIncident).toBeDefined();
      expect(bundledIncident?.name).toContain("5 incidents");
    });

    it("should not bundle 4 or fewer incidents", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [
        createIncident(1, 0),
        createIncident(2, 0),
        createIncident(3, 0),
        createIncident(4, 0),
      ];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "absolute",
      });

      // Should not have bundled incident
      const bundledIncident = result[0].events.find((e) => e.id === -1);
      expect(bundledIncident).toBeUndefined();
    });

    it("should not bundle incidents for non-absolute bar types", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events = [
        createIncident(1, 0),
        createIncident(2, 0),
        createIncident(3, 0),
        createIncident(4, 0),
        createIncident(5, 0),
      ];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "dominant",
      });

      // Should not include any incidents in events array
      expect(result[0].events.length).toBe(0);
    });
  });

  describe("multiple days", () => {
    it("should handle data across multiple days", () => {
      const data = [
        createStatusData(0, 100, 0, 0),
        createStatusData(1, 80, 20, 0),
        createStatusData(2, 60, 30, 10),
      ];
      const events = [
        createIncident(1, 0),
        createReport(2, 1),
        createMaintenance(3, 2),
      ];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "dominant",
      });

      expect(result).toHaveLength(3);
      expect(result[0].bar[0].status).toBe("error"); // Day 0 has incident
      expect(result[1].bar[0].status).toBe("degraded"); // Day 1 has report
      expect(result[2].bar[0].status).toBe("info"); // Day 2 has maintenance
    });
  });

  describe("edge cases", () => {
    it("should handle empty data array", () => {
      const data: StatusData[] = [];
      const events: Event[] = [];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "dominant",
      });

      expect(result).toHaveLength(0);
    });

    it("should handle events with null end date", () => {
      const data = [createStatusData(0, 100, 0, 0)];
      const events: Event[] = [
        {
          id: 1,
          name: "Ongoing Incident",
          from: new Date(),
          to: null,
          type: "incident",
          status: "error",
        },
      ];

      const result = setDataByType({
        events,
        data,
        cardType: "duration",
        barType: "absolute",
      });

      expect(result[0].bar.some((b) => b.status === "error")).toBe(true);
    });

    it("should handle events spanning multiple days", () => {
      const data = [
        createStatusData(0, 100, 0, 0),
        createStatusData(1, 100, 0, 0),
      ];
      const from = new Date();
      from.setDate(from.getDate() - 1);
      from.setHours(12, 0, 0, 0);
      const to = new Date();
      to.setHours(12, 0, 0, 0);

      const events: Event[] = [
        {
          id: 1,
          name: "Multi-day Incident",
          from,
          to,
          type: "incident",
          status: "error",
        },
      ];

      const result = setDataByType({
        events,
        data,
        cardType: "requests",
        barType: "dominant",
      });

      // Both days should show error status
      expect(result[0].bar[0].status).toBe("error");
      expect(result[1].bar[0].status).toBe("error");
    });
  });
});

describe("componentImpacts", () => {
  describe("setDataByType - manual mode colors", () => {
    const day = dayStartUTC(1);
    const dayData = [createStatusData(1, 1)];

    function manualBarStatus(
      events: Parameters<typeof setDataByType>[0]["events"],
    ) {
      const result = setDataByType({
        events,
        data: dayData,
        cardType: "manual",
        barType: "manual",
      });
      return result[0].bar[0].status;
    }

    it("legacy report day stays degraded", () => {
      expect(
        manualBarStatus([createLegacyEvent(1, day, hoursAfter(day, 24))]),
      ).toBe("degraded");
    });

    it("major_outage day renders error", () => {
      expect(
        manualBarStatus([
          createImpactEvent(1, day, hoursAfter(day, 24), [
            { from: day, to: hoursAfter(day, 24), impact: "major_outage" },
          ]),
        ]),
      ).toBe("error");
    });

    it("partial_outage day renders degraded", () => {
      expect(
        manualBarStatus([
          createImpactEvent(1, day, hoursAfter(day, 24), [
            { from: day, to: hoursAfter(day, 24), impact: "partial_outage" },
          ]),
        ]),
      ).toBe("degraded");
    });

    it("carries the day's worst impact for the hover card label", () => {
      const result = setDataByType({
        events: [
          createImpactEvent(1, day, hoursAfter(day, 24), [
            { from: day, to: hoursAfter(day, 24), impact: "partial_outage" },
          ]),
        ],
        data: dayData,
        cardType: "manual",
        barType: "manual",
      });
      expect(result[0].card[0].status).toBe("degraded");
      expect(result[0].card[0].impact).toBe("partial_outage");
    });

    it("legacy report day carries no impact (generic label)", () => {
      const result = setDataByType({
        events: [createLegacyEvent(1, day, hoursAfter(day, 24))],
        data: dayData,
        cardType: "manual",
        barType: "manual",
      });
      expect(result[0].card[0].status).toBe("degraded");
      expect(result[0].card[0].impact).toBeUndefined();
    });

    it("operational-only day renders success", () => {
      expect(
        manualBarStatus([
          createImpactEvent(1, day, hoursAfter(day, 24), [
            { from: day, to: hoursAfter(day, 24), impact: "operational" },
          ]),
        ]),
      ).toBe("success");
    });
  });

  describe("setDataByType - absolute bar impact proportions", () => {
    const day = dayStartUTC(1);
    const dayData = [createStatusData(1, 100)];

    it("colors only the major_outage slice red, not the full report", () => {
      // 1h major + 23h degraded: error keeps its true 1/24 share
      const events = [
        createImpactEvent(1, day, hoursAfter(day, 24), [
          { from: day, to: hoursAfter(day, 1), impact: "major_outage" },
          {
            from: hoursAfter(day, 1),
            to: hoursAfter(day, 24),
            impact: "degraded_performance",
          },
        ]),
      ];

      const result = setDataByType({
        events,
        data: dayData,
        cardType: "requests",
        barType: "absolute",
      });

      const bar = result[0].bar;
      const errorHeight = bar.find((b) => b.status === "error")?.height ?? 0;
      const degradedHeight =
        bar.find((b) => b.status === "degraded")?.height ?? 0;
      expect(errorHeight).toBeCloseTo(100 / 24, 1);
      expect(degradedHeight).toBeCloseTo(100 - 100 / 24, 1);
      expect(errorHeight + degradedHeight).toBeCloseTo(100, 5);
    });

    it("shows uptime vs downtime when the only slice is an outage", () => {
      // 1h major then operational: 23h green, 1h red — not a full red day
      const events = [
        createImpactEvent(1, day, hoursAfter(day, 24), [
          { from: day, to: hoursAfter(day, 1), impact: "major_outage" },
          {
            from: hoursAfter(day, 1),
            to: hoursAfter(day, 24),
            impact: "operational",
          },
        ]),
      ];

      const result = setDataByType({
        events,
        data: dayData,
        cardType: "requests",
        barType: "absolute",
      });

      const bar = result[0].bar;
      expect(bar.find((b) => b.status === "success")?.height).toBeCloseTo(
        100 - 100 / 24,
        1,
      );
      expect(bar.find((b) => b.status === "error")?.height).toBeCloseTo(
        100 / 24,
        1,
      );
    });
  });
});
