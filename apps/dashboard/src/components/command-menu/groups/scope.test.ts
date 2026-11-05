import { describe, expect, it } from "vitest";

import { MONITOR_TABS } from "@/app/(dashboard)/monitors/[id]/constants";
import { STATUS_PAGE_TABS } from "@/app/(dashboard)/status-pages/[id]/constants";

import { INCIDENT_ANCHORS, incidentScopeGroups } from "./incident-scope";
import { MONITOR_EDIT_ANCHORS, monitorScopeGroups } from "./monitor-scope";
import {
  STATUS_PAGE_EDIT_ANCHORS,
  statusPageScopeGroups,
} from "./status-page-scope";

type ScopeInput = Parameters<typeof statusPageScopeGroups>[0];

// safe because statusPageScopeGroups only reads the fields set in the fixtures
function rows<K extends "statusReports" | "maintenances">(
  items: Record<string, unknown>[],
): ScopeInput[K] {
  return items as unknown as ScopeInput[K];
}

describe("monitorScopeGroups", () => {
  it("lists every monitor tab under the monitor name", () => {
    const [group] = monitorScopeGroups({ type: "monitor", id: 3, name: "API" });
    expect(group.heading).toBe("API");
    expect(group.items.map((i) => i.action)).toEqual(
      MONITOR_TABS.map((t) => ({
        type: "navigate",
        href: `/monitors/3/${t.value}`,
      })),
    );
  });

  it("deep-links to edit page cards", () => {
    const [, settings] = monitorScopeGroups({
      type: "monitor",
      id: 3,
      name: "API",
    });
    expect(settings.items.map((i) => i.action)).toEqual(
      MONITOR_EDIT_ANCHORS.map((a) => ({
        type: "navigate",
        href: `/monitors/3/edit#${a.id}`,
      })),
    );
  });
});

describe("incidentScopeGroups", () => {
  type Input = Parameters<typeof incidentScopeGroups>[0];
  const page = { type: "incident" as const, id: 7, title: "API down" };
  // safe because incidentScopeGroups only reads the fields set in the fixtures
  const scope = (incident: Record<string, unknown>) =>
    incidentScopeGroups({
      page,
      incidents: [{ id: 7, ...incident }] as unknown as Input["incidents"],
      statusReports: [
        { id: 1, pageId: 4, title: "Outage", status: "investigating" },
        { id: 2, pageId: 4, title: "Old", status: "resolved" },
      ] as unknown as Input["statusReports"],
    });

  it("opens the incident and deep-links to its sections", () => {
    const [group] = scope({ status: "open", statusReport: null });
    expect(group.heading).toBe("API down");
    expect(group.items.map((i) => i.action)).toEqual([
      { type: "navigate", href: "/incidents/7" },
      ...INCIDENT_ANCHORS.map((a) => ({
        type: "navigate",
        href: `/incidents/7#${a.id}`,
      })),
    ]);
  });

  it("drops the postmortem for a canceled incident", () => {
    const [group] = scope({ status: "canceled", statusReport: null });
    expect(group.items.map((i) => i.label)).not.toContain("Postmortem");
  });

  it("offers an update and a link for the linked report", () => {
    const [, report] = scope({ status: "open", statusReport: { id: 1 } });
    expect(report.items.map((i) => i.action)).toEqual([
      { type: "sheet", sheet: { sheet: "status-report-update", reportId: 1 } },
      { type: "navigate", href: "/status-pages/4/status-reports/1" },
    ]);
  });

  it("only links a resolved report", () => {
    const [, report] = scope({ status: "resolved", statusReport: { id: 2 } });
    expect(report.items.map((i) => i.action)).toEqual([
      { type: "navigate", href: "/status-pages/4/status-reports/2" },
    ]);
  });

  it("has no report items without a linked report or while loading", () => {
    expect(scope({ status: "open", statusReport: null })[1].items).toEqual([]);
    const loading = incidentScopeGroups({
      page,
      incidents: undefined,
      statusReports: undefined,
    });
    expect(loading.map((g) => g.items.length)).toEqual([
      INCIDENT_ANCHORS.length + 1,
      0,
    ]);
  });
});

describe("statusPageScopeGroups", () => {
  const page = { type: "status-page" as const, id: 4, title: "Acme" };
  const from = new Date("2024-06-01T10:00:00Z");

  const groups = statusPageScopeGroups({
    page,
    statusReports: rows<"statusReports">([
      { id: 1, pageId: 4, title: "Outage", status: "investigating" },
      { id: 2, pageId: 4, title: "Old", status: "resolved" },
      { id: 3, pageId: 5, title: "Elsewhere", status: "investigating" },
    ]),
    maintenances: rows<"maintenances">([
      { id: 10, pageId: 4, title: "DB upgrade", from },
      { id: 11, pageId: 5, title: "Other page", from },
    ]),
  });
  const byHeading = Object.fromEntries(groups.map((g) => [g.heading, g]));

  it("returns the groups in order", () => {
    expect(groups.map((g) => g.heading)).toEqual([
      "Actions",
      "Status Reports",
      "Maintenances",
      "Pages",
      "Settings",
    ]);
  });

  it("deep-links to edit page cards", () => {
    expect(byHeading.Settings.items.map((i) => i.action)).toEqual(
      STATUS_PAGE_EDIT_ANCHORS.map((a) => ({
        type: "navigate",
        href: `/status-pages/4/edit#${a.id}`,
      })),
    );
  });

  it("scopes create actions to the page", () => {
    const [report, maintenance] = byHeading.Actions.items;
    expect(report.action).toEqual({
      type: "sheet",
      sheet: { sheet: "status-report", pageId: 4 },
    });
    expect(maintenance.action).toEqual({
      type: "sheet",
      sheet: { sheet: "maintenance", pageId: 4 },
    });
  });

  it("offers an update only for this page's unresolved reports", () => {
    const updates = byHeading.Actions.items.slice(2);
    expect(updates.map((i) => i.label)).toEqual(["Add Update to Outage"]);
    expect(updates[0].action).toEqual({
      type: "sheet",
      sheet: { sheet: "status-report-update", reportId: 1 },
    });
  });

  it("lists all of this page's reports, resolved included", () => {
    expect(byHeading["Status Reports"].items.map((i) => i.action)).toEqual([
      { type: "navigate", href: "/status-pages/4/status-reports/1" },
      { type: "navigate", href: "/status-pages/4/status-reports/2" },
    ]);
  });

  it("lists only this page's maintenances", () => {
    expect(byHeading.Maintenances.items.map((i) => i.value)).toEqual([
      "maintenance-10",
    ]);
  });

  it("links every page tab", () => {
    expect(byHeading.Pages.items.map((i) => i.action)).toEqual(
      STATUS_PAGE_TABS.map((t) => ({
        type: "navigate",
        href: `/status-pages/4/${t.value}`,
      })),
    );
  });

  it("keeps the static groups when data is still loading", () => {
    const loading = statusPageScopeGroups({
      page,
      statusReports: undefined,
      maintenances: undefined,
    });
    expect(loading.map((g) => g.items.length)).toEqual([
      2,
      0,
      0,
      STATUS_PAGE_TABS.length,
      STATUS_PAGE_EDIT_ANCHORS.length,
    ]);
  });
});
