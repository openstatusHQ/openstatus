import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import {
  buildOverviewData,
  getIncidentStatus,
  getMaintenanceStatus,
} from "./overview-events.client";

type Input = Parameters<typeof buildOverviewData>[0];

const now = new Date("2024-06-15T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

// safe because buildOverviewData only reads the fields set below
function input(partial: Partial<Record<keyof Input, unknown[]>>): Input {
  return {
    monitors: [],
    pages: [],
    monitorIncidents: [],
    statusReports: [],
    maintenances: [],
    ...partial,
  } as unknown as Input;
}

function metric(data: ReturnType<typeof buildOverviewData>, title: string) {
  return data.metrics.find((m) => m.title === title);
}

describe("getIncidentStatus", () => {
  it("prefers resolved over acknowledged", () => {
    expect(
      getIncidentStatus({ acknowledgedAt: daysAgo(2), resolvedAt: daysAgo(1) }),
    ).toBe("resolved");
    expect(
      getIncidentStatus({ acknowledgedAt: daysAgo(2), resolvedAt: null }),
    ).toBe("acknowledged");
    expect(getIncidentStatus({ acknowledgedAt: null, resolvedAt: null })).toBe(
      "ongoing",
    );
  });
});

describe("getMaintenanceStatus", () => {
  const window = { from: daysAgo(1), to: daysAgo(-1) };

  it("classifies relative to now", () => {
    expect(getMaintenanceStatus(window, daysAgo(2))).toBe("scheduled");
    expect(getMaintenanceStatus(window, now)).toBe("in-progress");
    expect(getMaintenanceStatus(window, daysAgo(-2))).toBe("completed");
  });

  it("counts the window bounds as in progress", () => {
    expect(getMaintenanceStatus(window, window.from)).toBe("in-progress");
    expect(getMaintenanceStatus(window, window.to)).toBe("in-progress");
  });
});

describe("buildOverviewData", () => {
  it("splits monitor incidents into open and recently resolved", () => {
    const open = { startedAt: daysAgo(1), resolvedAt: null };
    const recent = { startedAt: daysAgo(3), resolvedAt: daysAgo(2) };
    const old = { startedAt: daysAgo(30), resolvedAt: daysAgo(20) };
    const data = buildOverviewData(
      input({ monitorIncidents: [open, recent, old] }),
      now,
    );
    expect(data.needsAttention.map((e) => e.type)).toEqual(["incident"]);
    expect(data.recentlyResolved).toHaveLength(1);
    expect(metric(data, "Open Incidents")).toMatchObject({
      value: 1,
      variant: "destructive",
      href: undefined,
    });
  });

  it("counts managed incidents instead of monitor incidents when provided", () => {
    const data = buildOverviewData(
      {
        ...input({ monitorIncidents: [{ resolvedAt: null }] }),
        managedIncidents: [
          { status: "open" },
          { status: "mitigated" },
        ] as unknown as Input["managedIncidents"],
        endedIncidents: [
          {
            status: "resolved",
            resolvedAt: daysAgo(1),
            closedAt: daysAgo(1),
          },
        ] as unknown as Input["endedIncidents"],
      },
      now,
    );
    expect(metric(data, "Open Incidents")).toMatchObject({
      value: 2,
      href: "/incidents",
    });
    expect(
      data.recentlyResolved.filter((e) => e.type === "managedIncident"),
    ).toHaveLength(1);
  });

  it("separates maintenances from triage", () => {
    const upcoming = { from: daysAgo(-1), to: daysAgo(-2) };
    const finished = { from: daysAgo(3), to: daysAgo(2) };
    const data = buildOverviewData(
      input({ maintenances: [upcoming, finished] }),
      now,
    );
    expect(data.needsAttention).toEqual([]);
    expect(data.upcomingMaintenances).toHaveLength(1);
    expect(data.recentlyResolved).toHaveLength(1);
    expect(metric(data, "Scheduled Maintenances")).toMatchObject({
      value: 1,
      variant: "info",
    });
  });

  it("flags open status reports", () => {
    const data = buildOverviewData(
      input({
        statusReports: [
          { status: "investigating", createdAt: daysAgo(1), updates: [] },
          {
            status: "resolved",
            createdAt: daysAgo(3),
            updatedAt: daysAgo(2),
            updates: [{ date: daysAgo(2) }],
          },
        ],
      }),
      now,
    );
    expect(data.needsAttention.map((e) => e.type)).toEqual(["report"]);
    expect(data.recentlyResolved.map((e) => e.type)).toEqual(["report"]);
    expect(metric(data, "Open Reports")).toMatchObject({
      value: 1,
      variant: "warning",
    });
  });

  it("uses default variants when nothing is open", () => {
    const data = buildOverviewData(
      input({ monitors: [{}, {}], pages: [{}] }),
      now,
    );
    expect(
      data.metrics.map(({ title, value, variant }) => ({
        title,
        value,
        variant,
      })),
    ).toEqual([
      { title: "Monitors", value: 2, variant: "default" },
      { title: "Status Pages", value: 1, variant: "default" },
      { title: "Open Incidents", value: 0, variant: "default" },
      { title: "Open Reports", value: 0, variant: "default" },
      { title: "Scheduled Maintenances", value: 0, variant: "default" },
    ]);
  });
});
