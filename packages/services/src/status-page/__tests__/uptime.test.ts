import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import {
  createImpactEvent,
  createIncident,
  createLegacyEvent,
  createReport,
  createStatusData,
  dayStartUTC,
  hoursAfter,
} from "../../../test/timeline-fixtures";
import type { Event, StatusData } from "../../status-timeline";
import { getUptime } from "../uptime";

describe("getUptime", () => {
  describe("manual bar type", () => {
    it("should calculate uptime based on report durations", () => {
      const data = Array.from({ length: 45 }, (_, i) =>
        createStatusData(i, 100, 0, 0),
      );
      const events = [createReport(1, 0, 24)]; // 1 day downtime

      const uptime = getUptime({
        data,
        events,
        barType: "manual",
        cardType: "manual",
      });

      // Should be approximately 97.78% (44/45 days)
      expect(Number.parseFloat(uptime)).toBeGreaterThan(97);
      expect(Number.parseFloat(uptime)).toBeLessThan(98);
    });

    it("should only consider reports not incidents", () => {
      const data = Array.from({ length: 45 }, (_, i) =>
        createStatusData(i, 100, 0, 0),
      );
      const events = [createIncident(1, 0, 24)]; // Should be ignored

      const uptime = getUptime({
        data,
        events,
        barType: "manual",
        cardType: "manual",
      });

      expect(uptime).toBe("100%");
    });

    it("should clamp report durations to the lookback window and never go negative", () => {
      const data = Array.from({ length: 45 }, (_, i) =>
        createStatusData(i, 100, 0, 0),
      );
      // Create reports that started well before the 45-day window
      const events: Event[] = Array.from({ length: 15 }, (_, i) => {
        const from = new Date();
        from.setDate(from.getDate() - (60 + i * 30)); // 60 to 480 days ago
        const to = new Date(from);
        to.setDate(to.getDate() + 2); // each 2 days long
        return {
          id: i + 1,
          name: `Old Report ${i}`,
          from,
          to,
          type: "report" as const,
          status: "degraded" as const,
        };
      });

      const uptime = getUptime({
        data,
        events,
        barType: "manual",
        cardType: "manual",
      });

      // Reports are entirely outside the window, so uptime should be 100%
      expect(Number.parseFloat(uptime)).toBe(100);
    });

    it("should clamp partially overlapping reports to the window boundary", () => {
      const data = Array.from({ length: 45 }, (_, i) =>
        createStatusData(i, 100, 0, 0),
      );
      // Report started 50 days ago (before window) and ended 40 days ago (inside window)
      const from = new Date();
      from.setDate(from.getDate() - 50);
      const to = new Date();
      to.setDate(to.getDate() - 40);
      const events: Event[] = [
        {
          id: 1,
          name: "Overlapping Report",
          from,
          to,
          type: "report",
          status: "degraded",
        },
      ];

      const uptime = getUptime({
        data,
        events,
        barType: "manual",
        cardType: "manual",
      });

      // Only ~5 days should count (from window start to report end), not 10 days
      const uptimeNum = Number.parseFloat(uptime);
      expect(uptimeNum).toBeGreaterThan(85);
      expect(uptimeNum).toBeLessThan(100);
    });
  });

  describe("duration card type", () => {
    it("should calculate uptime based on incident durations", () => {
      const data = Array.from({ length: 45 }, (_, i) =>
        createStatusData(i, 100, 0, 0),
      );
      const events = [createIncident(1, 0, 24)]; // 1 day downtime

      const uptime = getUptime({
        data,
        events,
        barType: "absolute",
        cardType: "duration",
      });

      // Should be approximately 97.78% (44/45 days)
      expect(Number.parseFloat(uptime)).toBeGreaterThan(97);
      expect(Number.parseFloat(uptime)).toBeLessThan(98);
    });
    it("should ignore legacy reports (no impact rows) when calculating duration uptime", () => {
      const data = Array.from({ length: 45 }, (_, i) =>
        createStatusData(i, 100, 0, 0),
      );
      const events = [createReport(2, 0, 24)]; // Should be ignored

      const uptime = getUptime({
        data,
        events,
        barType: "absolute",
        cardType: "duration",
      });

      expect(uptime).toBe("100%");
    });
  });

  describe("request card type", () => {
    it("should calculate uptime based on ok vs total requests", () => {
      const data = [
        createStatusData(0, 90, 5, 5), // 95 ok, 100 total
        createStatusData(1, 100, 0, 0), // 100 ok, 100 total
      ];
      const events: Event[] = [];

      const uptime = getUptime({
        data,
        events,
        barType: "absolute",
        cardType: "requests",
      });

      // (90+5+100) / (90+5+5+100) = 195/200 = 97.5%
      expect(uptime).toBe("97.5%");
    });

    it("should count degraded as ok", () => {
      const data = [createStatusData(0, 80, 20, 0)];
      const events: Event[] = [];

      const uptime = getUptime({
        data,
        events,
        barType: "absolute",
        cardType: "requests",
      });

      expect(uptime).toBe("100%");
    });

    it("should return 100% for empty data", () => {
      const data: StatusData[] = [];
      const events: Event[] = [];

      const uptime = getUptime({
        data,
        events,
        barType: "absolute",
        cardType: "requests",
      });

      expect(uptime).toBe("100%");
    });

    it("should return 100% when total is zero", () => {
      const data = [createStatusData(0, 0, 0, 0)];
      const events: Event[] = [];

      const uptime = getUptime({
        data,
        events,
        barType: "absolute",
        cardType: "requests",
      });

      expect(uptime).toBe("100%");
    });
  });
});

describe("componentImpacts", () => {
  describe("getUptime - manual mode weighting", () => {
    const day = dayStartUTC(1);
    const dayData = [createStatusData(1, 1)];

    it("legacy report (no impact rows) counts its full duration", () => {
      const events = [createLegacyEvent(1, day, hoursAfter(day, 24))];
      expect(
        getUptime({
          data: dayData,
          events,
          barType: "manual",
          cardType: "manual",
        }),
      ).toBe("0%");
    });

    it("major_outage counts full downtime", () => {
      const events = [
        createImpactEvent(1, day, hoursAfter(day, 24), [
          { from: day, to: hoursAfter(day, 24), impact: "major_outage" },
        ]),
      ];
      expect(
        getUptime({
          data: dayData,
          events,
          barType: "manual",
          cardType: "manual",
        }),
      ).toBe("0%");
    });

    it("partial_outage counts half downtime (weight 0.5)", () => {
      const events = [
        createImpactEvent(1, day, hoursAfter(day, 24), [
          { from: day, to: hoursAfter(day, 24), impact: "partial_outage" },
        ]),
      ];
      expect(
        getUptime({
          data: dayData,
          events,
          barType: "manual",
          cardType: "manual",
        }),
      ).toBe("50%");
    });

    it("degraded_performance counts as up", () => {
      const events = [
        createImpactEvent(1, day, hoursAfter(day, 24), [
          {
            from: day,
            to: hoursAfter(day, 24),
            impact: "degraded_performance",
          },
        ]),
      ];
      expect(
        getUptime({
          data: dayData,
          events,
          barType: "manual",
          cardType: "manual",
        }),
      ).toBe("100%");
    });

    it("operational rows count as up", () => {
      const events = [
        createImpactEvent(1, day, hoursAfter(day, 24), [
          { from: day, to: hoursAfter(day, 24), impact: "operational" },
        ]),
      ];
      expect(
        getUptime({
          data: dayData,
          events,
          barType: "manual",
          cardType: "manual",
        }),
      ).toBe("100%");
    });

    it("weights each interval of a multi-update timeline", () => {
      // major 6h -> degraded 6h -> operational 12h: only the major 6h count
      const events = [
        createImpactEvent(1, day, hoursAfter(day, 24), [
          { from: day, to: hoursAfter(day, 6), impact: "major_outage" },
          {
            from: hoursAfter(day, 6),
            to: hoursAfter(day, 12),
            impact: "degraded_performance",
          },
          {
            from: hoursAfter(day, 12),
            to: hoursAfter(day, 24),
            impact: "operational",
          },
        ]),
      ];
      expect(
        getUptime({
          data: dayData,
          events,
          barType: "manual",
          cardType: "manual",
        }),
      ).toBe("75%");
    });

    it("partial_outage intervals count half in a multi-update timeline", () => {
      // major 6h (6h down) -> partial 6h (3h down) -> operational 12h
      const events = [
        createImpactEvent(1, day, hoursAfter(day, 24), [
          { from: day, to: hoursAfter(day, 6), impact: "major_outage" },
          {
            from: hoursAfter(day, 6),
            to: hoursAfter(day, 12),
            impact: "partial_outage",
          },
          {
            from: hoursAfter(day, 12),
            to: hoursAfter(day, 24),
            impact: "operational",
          },
        ]),
      ];
      expect(
        getUptime({
          data: dayData,
          events,
          barType: "manual",
          cardType: "manual",
        }),
      ).toBe("62.5%");
    });

    it("mixes legacy and impact reports in one period", () => {
      const day2 = dayStartUTC(2);
      const data = [createStatusData(2, 1), createStatusData(1, 1)];
      const events = [
        createLegacyEvent(1, day2, hoursAfter(day2, 24)),
        createImpactEvent(2, day, hoursAfter(day, 24), [
          {
            from: day,
            to: hoursAfter(day, 24),
            impact: "degraded_performance",
          },
        ]),
      ];
      expect(
        getUptime({ data, events, barType: "manual", cardType: "manual" }),
      ).toBe("50%");
    });

    it("overlapping legacy reports count once and never go negative", () => {
      const events = [
        createLegacyEvent(1, day, hoursAfter(day, 24)),
        createLegacyEvent(2, day, hoursAfter(day, 24)),
      ];
      expect(
        getUptime({
          data: dayData,
          events,
          barType: "manual",
          cardType: "manual",
        }),
      ).toBe("0%");
    });

    it("partially overlapping reports merge their downtime", () => {
      const day2 = dayStartUTC(2);
      const data = [createStatusData(2, 1), createStatusData(1, 1)];
      // 0-24h and 12-36h overlap by 12h: 36h downtime over 48h, not 48h
      const events = [
        createLegacyEvent(1, day2, hoursAfter(day2, 24)),
        createLegacyEvent(2, hoursAfter(day2, 12), hoursAfter(day2, 36)),
      ];
      expect(
        getUptime({ data, events, barType: "manual", cardType: "manual" }),
      ).toBe("25%");
    });

    it("overlapping partial_outage reports take the worst weight, not the sum", () => {
      const events = [
        createImpactEvent(1, day, hoursAfter(day, 24), [
          { from: day, to: hoursAfter(day, 24), impact: "partial_outage" },
        ]),
        createImpactEvent(2, day, hoursAfter(day, 24), [
          { from: day, to: hoursAfter(day, 24), impact: "partial_outage" },
        ]),
      ];
      expect(
        getUptime({
          data: dayData,
          events,
          barType: "manual",
          cardType: "manual",
        }),
      ).toBe("50%");
    });

    it("overlapping legacy and partial_outage reports take the worst weight", () => {
      const events = [
        createLegacyEvent(1, day, hoursAfter(day, 24)),
        createImpactEvent(2, day, hoursAfter(day, 24), [
          { from: day, to: hoursAfter(day, 24), impact: "partial_outage" },
        ]),
      ];
      expect(
        getUptime({
          data: dayData,
          events,
          barType: "manual",
          cardType: "manual",
        }),
      ).toBe("0%");
    });
  });

  describe("getUptime - duration mode impact downtime", () => {
    const day = dayStartUTC(1);
    const day2 = dayStartUTC(2);
    const twoDayData = [createStatusData(2, 1), createStatusData(1, 1)];

    function createIncidentEvent(id: number, from: Date, to: Date | null) {
      return {
        id,
        name: "Downtime",
        from,
        to,
        type: "incident" as const,
        status: "error" as const,
      };
    }

    it("major_outage report intervals count as downtime", () => {
      const events = [
        createImpactEvent(1, day2, hoursAfter(day2, 24), [
          { from: day2, to: hoursAfter(day2, 24), impact: "major_outage" },
        ]),
      ];
      expect(
        getUptime({
          data: twoDayData,
          events,
          barType: "absolute",
          cardType: "duration",
        }),
      ).toBe("50%");
    });

    it("partial_outage report intervals count half", () => {
      const events = [
        createImpactEvent(1, day2, hoursAfter(day2, 24), [
          { from: day2, to: hoursAfter(day2, 24), impact: "partial_outage" },
        ]),
      ];
      expect(
        getUptime({
          data: twoDayData,
          events,
          barType: "absolute",
          cardType: "duration",
        }),
      ).toBe("75%");
    });

    it("degraded_performance report intervals count as up", () => {
      const events = [
        createImpactEvent(1, day2, hoursAfter(day2, 24), [
          {
            from: day2,
            to: hoursAfter(day2, 24),
            impact: "degraded_performance",
          },
        ]),
      ];
      expect(
        getUptime({
          data: twoDayData,
          events,
          barType: "absolute",
          cardType: "duration",
        }),
      ).toBe("100%");
    });

    it("incident and overlapping major_outage report count once", () => {
      const events = [
        createIncidentEvent(1, day2, hoursAfter(day2, 24)),
        createImpactEvent(2, day2, hoursAfter(day2, 24), [
          { from: day2, to: hoursAfter(day2, 24), impact: "major_outage" },
        ]),
      ];
      expect(
        getUptime({
          data: twoDayData,
          events,
          barType: "absolute",
          cardType: "duration",
        }),
      ).toBe("50%");
    });

    it("incident downtime wins over an overlapping partial_outage report", () => {
      const events = [
        createIncidentEvent(1, day2, hoursAfter(day2, 24)),
        createImpactEvent(2, day2, hoursAfter(day2, 24), [
          { from: day2, to: hoursAfter(day2, 24), impact: "partial_outage" },
        ]),
      ];
      expect(
        getUptime({
          data: twoDayData,
          events,
          barType: "absolute",
          cardType: "duration",
        }),
      ).toBe("50%");
    });

    it("legacy reports stay ignored alongside impact reports", () => {
      const events = [
        createLegacyEvent(1, day2, hoursAfter(day2, 24)),
        createImpactEvent(2, day, hoursAfter(day, 12), [
          { from: day, to: hoursAfter(day, 12), impact: "major_outage" },
        ]),
      ];
      expect(
        getUptime({
          data: twoDayData,
          events,
          barType: "absolute",
          cardType: "duration",
        }),
      ).toBe("75%");
    });
  });
});
