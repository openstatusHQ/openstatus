import { expect } from "@std/expect";
import { describe, it } from "@std/testing/bdd";

import { MONITOR_TABS } from "@/app/(dashboard)/monitors/[id]/constants";
import { STATUS_PAGE_TABS } from "@/app/(dashboard)/status-pages/[id]/constants";

import { monitorScopeGroups } from "./monitor-scope";
import { statusPageScopeGroups } from "./status-page-scope";

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
    ]);
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
    ]);
  });
});
