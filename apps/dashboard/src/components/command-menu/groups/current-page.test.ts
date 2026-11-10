import { describe, expect, it } from "vitest";

import { MONITOR_TABS } from "@/app/(dashboard)/monitors/[id]/constants";

import { routeContext } from "../route-context";
import type { CurrentPageData } from "./current-page";
import { currentPageGroup } from "./current-page";
import { INCIDENT_ANCHORS } from "./incident-scope";
import { MONITOR_EDIT_ANCHORS } from "./monitor-scope";

// safe because currentPageGroup only reads the fields set in the fixtures
const data = {
  monitors: [{ id: 3, name: "API" }],
  statusPages: [{ id: 4, title: "Acme" }],
  incidents: [
    { id: 7, title: "API down", status: "open", statusReport: { id: 1 } },
  ],
  statusReports: [
    { id: 1, pageId: 4, title: "Outage", status: "investigating" },
    { id: 2, pageId: 4, title: "Degraded", status: "monitoring" },
  ],
  sortedStatusReports: [
    { id: 1, pageId: 4, title: "Outage", status: "investigating" },
    { id: 2, pageId: 4, title: "Degraded", status: "monitoring" },
  ],
  sortedMaintenances: [],
} as unknown as CurrentPageData;

const group = (pathname: string, d: CurrentPageData = data) =>
  currentPageGroup({ context: routeContext(pathname), pathname, data: d });

const hrefs = (pathname: string) =>
  group(pathname)
    ?.items.map((i) => i.action)
    .filter((a) => a.type === "navigate")
    .map((a) => a.href);

describe("currentPageGroup", () => {
  it("is absent outside detail pages", () => {
    expect(group("/overview")).toBeNull();
    expect(group("/monitors")).toBeNull();
  });

  it("is absent until the entity is loaded or when it does not exist", () => {
    expect(group("/monitors/3", { ...data, monitors: undefined })).toBeNull();
    expect(group("/monitors/99")).toBeNull();
  });

  it("names the group after the entity", () => {
    expect(group("/monitors/3/logs")?.heading).toBe("API");
    expect(group("/status-pages/4/edit")?.heading).toBe("Acme");
    expect(group("/incidents/7")?.heading).toBe("API down");
  });

  it("skips the tab the user is on and other pages' anchors", () => {
    expect(hrefs("/monitors/3/logs")).toEqual(
      MONITOR_TABS.filter((t) => t.value !== "logs").map(
        (t) => `/monitors/3/${t.value}`,
      ),
    );
  });

  it("offers the section anchors of the page the user is on", () => {
    expect(hrefs("/monitors/3/edit/")).toEqual([
      ...MONITOR_TABS.filter((t) => t.value !== "edit").map(
        (t) => `/monitors/3/${t.value}`,
      ),
      ...MONITOR_EDIT_ANCHORS.map((a) => `/monitors/3/edit#${a.id}`),
    ]);
  });

  it("puts the viewed report's update first on a report page", () => {
    const items = group("/status-pages/4/status-reports/2")?.items ?? [];
    expect(items.slice(0, 4).map((i) => i.action)).toEqual([
      { type: "sheet", sheet: { sheet: "status-report-update", reportId: 2 } },
      { type: "sheet", sheet: { sheet: "status-report", pageId: 4 } },
      { type: "sheet", sheet: { sheet: "maintenance", pageId: 4 } },
      { type: "sheet", sheet: { sheet: "status-report-update", reportId: 1 } },
    ]);
  });

  it("leads with the linked report on an incident and drops the self link", () => {
    expect(group("/incidents/7")?.items[0].action).toEqual({
      type: "sheet",
      sheet: { sheet: "status-report-update", reportId: 1 },
    });
    expect(hrefs("/incidents/7")).toEqual([
      "/status-pages/4/status-reports/1",
      ...INCIDENT_ANCHORS.map((a) => `/incidents/7#${a.id}`),
    ]);
  });

  it("ends with a scope item and keeps values unique", () => {
    const items = group("/status-pages/4/status-reports")?.items ?? [];
    expect(items.at(-1)?.action).toEqual({
      type: "push",
      page: { type: "status-page", id: 4, title: "Acme" },
    });
    expect(items.every((i) => i.value.startsWith("current-"))).toBe(true);
    expect(new Set(items.map((i) => i.value)).size).toBe(items.length);
  });
});
