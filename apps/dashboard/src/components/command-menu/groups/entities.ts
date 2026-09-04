import type { RouterOutputs } from "@openstatus/api";

import type { CommandMenuGroup } from "../types";

type Monitor = RouterOutputs["monitor"]["list"][number];
type StatusPage = RouterOutputs["page"]["list"][number];
type StatusReport = RouterOutputs["statusReport"]["list"][number];
type Maintenance = RouterOutputs["maintenance"]["list"][number];
type Workspace = RouterOutputs["workspace"]["list"][number];

export function monitorsGroup(
  monitors: Monitor[] | undefined,
): CommandMenuGroup | null {
  if (!monitors || monitors.length === 0) return null;
  return {
    heading: "Monitors",
    idleLimit: 5,
    items: monitors.map((m) => ({
      value: `monitor-${m.id}`,
      label: m.name,
      description: m.url,
      keywords: [m.name, m.url],
      action: {
        type: "push",
        page: { type: "monitor", id: m.id, name: m.name },
      },
    })),
  };
}

export function statusPagesGroup(
  statusPages: StatusPage[] | undefined,
): CommandMenuGroup | null {
  if (!statusPages || statusPages.length === 0) return null;
  return {
    heading: "Status Pages",
    idleLimit: 5,
    items: statusPages.map((p) => ({
      value: `status-page-${p.id}`,
      label: p.title,
      description: p.slug,
      keywords: [p.title, p.slug, p.customDomain].filter(Boolean) as string[],
      action: {
        type: "push",
        page: { type: "status-page", id: p.id, title: p.title },
      },
    })),
  };
}

export function statusReportsGroup(
  sortedStatusReports: StatusReport[] | undefined,
): CommandMenuGroup | null {
  if (!sortedStatusReports || sortedStatusReports.length === 0) return null;
  return {
    heading: "Status Reports",
    idleLimit: 5,
    items: sortedStatusReports.map((r) => ({
      value: `status-report-${r.id}`,
      label: r.title,
      description: `${r.status} · ${r.page.title}`,
      keywords: [r.title, r.status, r.page.title],
      action: {
        type: "navigate",
        href: `/status-pages/${r.pageId}/status-reports/${r.id}`,
      },
    })),
  };
}

export function maintenancesGroup(
  sortedMaintenances: Maintenance[] | undefined,
  pageTitleById: Map<number, string>,
): CommandMenuGroup | null {
  if (!sortedMaintenances || sortedMaintenances.length === 0) return null;
  return {
    heading: "Maintenances",
    idleLimit: 5,
    items: sortedMaintenances.map((m) => ({
      value: `maintenance-${m.id}`,
      label: m.title,
      description: m.from.toLocaleString(),
      keywords: [m.title, pageTitleById.get(m.pageId ?? -1) ?? ""].filter(
        Boolean,
      ),
      action: {
        type: "navigate",
        href: `/status-pages/${m.pageId}/maintenances`,
      },
    })),
  };
}

export function workspacesGroup(
  otherWorkspaces: Workspace[],
  switchWorkspace: (slug: string) => void,
): CommandMenuGroup | null {
  if (otherWorkspaces.length === 0) return null;
  return {
    heading: "Workspace",
    items: otherWorkspaces.map((w) => ({
      value: `workspace-${w.id}`,
      label: w.name || "Untitled Workspace",
      description: w.slug,
      keywords: [w.name || "Untitled Workspace", w.slug],
      action: { type: "run", run: () => switchWorkspace(w.slug) },
    })),
  };
}
