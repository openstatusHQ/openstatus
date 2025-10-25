import { describe, expect, it } from "bun:test";
import {
  fillStatusDataFor45Days,
  getUptime,
  setDataByType,
} from "./statusPage.utils";

type StatusData = {
  day: string;
  count: number;
  ok: number;
  degraded: number;
  error: number;
  monitorId: string;
};

type Event = {
  id: number;
  name: string;
  from: Date;
  to: Date | null;
  type: "maintenance" | "incident" | "report";
  status: "success" | "degraded" | "error" | "info";
};

// Helper functions to create test data
function createStatusData(
  daysAgo: number,
  ok = 0,
  degraded = 0,
  error = 0,
): StatusData {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setUTCHours(0, 0, 0, 0);

  return {
    day: date.toISOString(),
    count: ok + degraded + error,
    ok,
    degraded,
    error,
    monitorId: "1",
  };
}

function createIncident(id: number, daysAgo: number, durationHours = 1): Event {
  const from = new Date();
  from.setDate(from.getDate() - daysAgo);
  from.setHours(from.getHours() - durationHours);

  const to = new Date(from);
  to.setHours(to.getHours() + durationHours);

  return {
    id,
    name: "Downtime",
    from,
    to,
    type: "incident",
    status: "error",
  };
}

function createReport(id: number, daysAgo: number, durationHours = 2): Event {
  const from = new Date();
  from.setDate(from.getDate() - daysAgo);
  from.setHours(from.getHours() - durationHours);

  const to = new Date(from);
  to.setHours(to.getHours() + durationHours);

  return {
    id,
    name: "Performance Issues",
    from,
    to,
    type: "report",
    status: "degraded",
  };
}

function createMaintenance(
  id: number,
  daysAgo: number,
  durationHours = 1,
): Event {
  const from = new Date();
  from.setDate(from.getDate() - daysAgo);
  from.setHours(from.getHours() - durationHours);

  const to = new Date(from);
  to.setHours(to.getHours() + durationHours);

  return {
    id,
    name: "Scheduled Maintenance",
    from,
    to,
    type: "maintenance",
    status: "info",
  };
}

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

describe("fillStatusDataFor45Days", () => {
  it("should fill all 45 days", () => {
    const data: StatusData[] = [];
    const result = fillStatusDataFor45Days(data, "1");

    expect(result).toHaveLength(45);
  });

  it("should sort data by day oldest first", () => {
    const data: StatusData[] = [];
    const result = fillStatusDataFor45Days(data, "1");

    for (let i = 1; i < result.length; i++) {
      const prev = new Date(result[i - 1].day);
      const curr = new Date(result[i].day);
      expect(curr.getTime()).toBeGreaterThan(prev.getTime());
    }
  });

  it("should preserve existing data", () => {
    const existingData = [createStatusData(5, 100, 50, 10)];
    const result = fillStatusDataFor45Days(existingData, "1");

    expect(result).toHaveLength(45);
    const matchingDay = result.find(
      (d) => d.ok === 100 && d.degraded === 50 && d.error === 10,
    );
    expect(matchingDay).toBeDefined();
  });

  it("should fill missing days with zeros", () => {
    const existingData = [createStatusData(5, 100, 0, 0)];
    const result = fillStatusDataFor45Days(existingData, "1");

    const emptyDays = result.filter((d) => d.count === 0);
    expect(emptyDays.length).toBe(44);
  });
});

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
    it("should ignore reports when calculating duration uptime", () => {
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
