import type { RouterOutputs } from "@openstatus/api";
import { ChevronRight } from "lucide-react";

import type { RouteContext } from "../route-context";
import type { CommandMenuGroup, CommandMenuItem, CommandPage } from "../types";
import { pageLabel } from "../types";
import { incidentScopeGroups } from "./incident-scope";
import { monitorScopeGroups } from "./monitor-scope";
import { statusPageScopeGroups } from "./status-page-scope";

type Monitor = RouterOutputs["monitor"]["list"][number];
type StatusPage = RouterOutputs["page"]["list"][number];
type Incident = RouterOutputs["incident"]["list"][number];
type StatusReport = RouterOutputs["statusReport"]["list"][number];
type Maintenance = RouterOutputs["maintenance"]["list"][number];

export type CurrentPageData = {
  monitors: Monitor[] | undefined;
  statusPages: StatusPage[] | undefined;
  incidents: Incident[] | undefined;
  statusReports: StatusReport[] | undefined;
  sortedStatusReports: StatusReport[] | undefined;
  sortedMaintenances: Maintenance[] | undefined;
};

function resolvePage(
  context: RouteContext,
  data: CurrentPageData,
): CommandPage | null {
  switch (context.type) {
    case "monitor": {
      const m = data.monitors?.find((x) => x.id === context.id);
      return m ? { type: "monitor", id: m.id, name: m.name } : null;
    }
    case "status-page": {
      const p = data.statusPages?.find((x) => x.id === context.id);
      return p ? { type: "status-page", id: p.id, title: p.title } : null;
    }
    case "incident": {
      const i = data.incidents?.find((x) => x.id === context.id);
      return i ? { type: "incident", id: i.id, title: i.title } : null;
    }
  }
}

// Open reports beyond this stay in the scoped view, which lists them all.
const MAX_REPORT_UPDATES = 3;

// Keyed lookup so a reorder of a scope builder cannot change what shows here.
function itemsOf(groups: CommandMenuGroup[], key: string): CommandMenuItem[] {
  return groups.find((g) => g.key === key)?.items ?? [];
}

// The likely next steps from the page the user is on: the entity's sub-pages
// and actions. Long entity lists stay behind the "Scope to" item.
function candidateItems(
  page: CommandPage,
  context: RouteContext,
  data: CurrentPageData,
): CommandMenuItem[] {
  switch (page.type) {
    case "monitor": {
      const groups = monitorScopeGroups(page);
      return [...itemsOf(groups, "monitor"), ...itemsOf(groups, "sections")];
    }
    case "incident": {
      const groups = incidentScopeGroups({
        page,
        incidents: data.incidents,
        statusReports: data.statusReports,
      });
      return [...itemsOf(groups, "report"), ...itemsOf(groups, "incident")];
    }
    case "status-page": {
      const groups = statusPageScopeGroups({
        page,
        statusReports: data.sortedStatusReports,
        maintenances: data.sortedMaintenances,
      });
      const reportId = context.type === "status-page" && context.reportId;
      const viewedUpdate = `add-update-${reportId}`;
      const actions = itemsOf(groups, "actions");
      const isUpdate = (i: CommandMenuItem) =>
        i.action.type === "sheet" &&
        i.action.sheet.sheet === "status-report-update";
      const viewed = actions.filter((i) => i.value === viewedUpdate);
      const otherUpdates = actions
        .filter((i) => isUpdate(i) && i.value !== viewedUpdate)
        .slice(0, MAX_REPORT_UPDATES - viewed.length);
      return [
        ...viewed,
        ...actions.filter((i) => !isUpdate(i)),
        ...otherUpdates,
        ...itemsOf(groups, "pages"),
        ...itemsOf(groups, "sections"),
      ];
    }
  }
}

// Drop the link to where the user already is, and section anchors of other
// pages (they belong to the scoped view).
function isUseful(item: CommandMenuItem, pathname: string): boolean {
  if (item.action.type !== "navigate") return true;
  const [path, hash] = item.action.href.split("#");
  return hash ? path === pathname : path !== pathname;
}

export function currentPageGroup({
  context,
  pathname,
  data,
}: {
  context: RouteContext | null;
  pathname: string;
  data: CurrentPageData;
}): CommandMenuGroup | null {
  if (!context) return null;
  const page = resolvePage(context, data);
  if (!page) return null;
  const label = pageLabel(page);
  const path = pathname.replace(/\/+$/, "");

  // Prefixed: root groups reuse labels like "Overview" and "Settings", and
  // cmdk needs every value unique.
  const items: CommandMenuItem[] = candidateItems(page, context, data)
    .filter((item) => isUseful(item, path))
    .map((item) => ({
      ...item,
      value: `current-${item.value}`,
      keywords: [item.label, ...(item.keywords ?? [])],
    }));

  items.push({
    value: "current-scope",
    label: `Scope to ${label}`,
    icon: ChevronRight,
    keywords: [label, "scope", "more"],
    action: { type: "push", page },
  });

  return { heading: label, key: "current-page", items };
}
