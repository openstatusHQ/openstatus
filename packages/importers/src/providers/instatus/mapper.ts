import type {
  InstatusComponent,
  InstatusIncident,
  InstatusMaintenance,
  InstatusPage,
  InstatusSubscriber,
} from "./api-types";

export type StatusReportStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved";

export function mapPage(page: InstatusPage, workspaceId: number) {
  return {
    workspaceId,
    title: page.name,
    description: "",
    slug: page.subdomain,
    customDomain: page.customDomain ?? "",
    published: true,
    icon: "",
  };
}

export function partitionComponents(components: InstatusComponent[]): {
  groups: InstatusComponent[];
  components: InstatusComponent[];
  warnings: string[];
} {
  const groupIds = new Set<string>();
  for (const c of components) {
    if (c.group) {
      groupIds.add(c.group);
    }
  }

  const componentById = new Map(components.map((c) => [c.id, c]));
  const groups: InstatusComponent[] = [];
  const regular: InstatusComponent[] = [];
  const warnings: string[] = [];

  // Collect groups: real components that are referenced as groups
  for (const groupId of Array.from(groupIds)) {
    const groupComponent = componentById.get(groupId);
    if (groupComponent) {
      groups.push(groupComponent);
    } else {
      // Group ID referenced but not found in component list — create synthetic group
      groups.push({
        id: groupId,
        name: groupId,
        description: null,
        status: "OPERATIONAL",
        order: 0,
        group: null,
        showUptime: false,
        grouped: false,
      });
      warnings.push(
        `Component group "${groupId}" referenced but not found in component list. Using ID as name.`,
      );
    }
  }

  // Collect regular components (not used as groups)
  for (const c of components) {
    if (!groupIds.has(c.id)) {
      regular.push(c);
    }
  }

  return { groups, components: regular, warnings };
}

export function mapComponentGroup(
  group: InstatusComponent,
  workspaceId: number,
  pageId?: number,
) {
  return {
    workspaceId,
    pageId,
    name: group.name,
  };
}

export function mapComponent(
  component: InstatusComponent,
  workspaceId: number,
  pageId?: number,
) {
  return {
    workspaceId,
    pageId,
    type: "static" as const,
    monitorId: null,
    name: component.name,
    description: component.description ?? null,
    order: component.order ?? 0,
  };
}

export function mapIncidentStatus(status: string): StatusReportStatus {
  const lower = status.toLowerCase();
  if (
    lower === "investigating" ||
    lower === "identified" ||
    lower === "monitoring" ||
    lower === "resolved"
  ) {
    return lower;
  }
  return "investigating";
}

export function mapIncidentToStatusReport(
  incident: InstatusIncident,
  workspaceId: number,
  pageId?: number,
) {
  const updates = [...(incident.updates ?? [])].sort(
    (a, b) => new Date(a.started).getTime() - new Date(b.started).getTime(),
  );

  const mappedUpdates = updates.map((u) => ({
    status: mapIncidentStatus(u.status),
    message: u.message ?? "",
    date: new Date(u.started),
  }));

  const lastUpdate = updates[updates.length - 1];
  const reportStatus = lastUpdate
    ? mapIncidentStatus(lastUpdate.status)
    : "investigating";

  const sourceComponentIds: string[] = (incident.components ?? []).map(
    (c) => c.id,
  );

  return {
    report: {
      title: incident.name,
      status: reportStatus,
      workspaceId,
      pageId,
    },
    updates: mappedUpdates,
    sourceComponentIds,
  };
}

export function mapMaintenanceToMaintenance(
  m: InstatusMaintenance,
  workspaceId: number,
  pageId?: number,
) {
  const updates = m.updates ?? [];
  const message = updates
    .map((u) => u.message ?? "")
    .filter(Boolean)
    .join("\n");

  const from = new Date(m.start);
  const duration = m.duration ?? 0;
  const to = duration > 0 ? new Date(from.getTime() + duration * 60_000) : from;

  return {
    title: m.name,
    message,
    from,
    to,
    workspaceId,
    pageId,
  };
}

export function mapSubscriber(
  subscriber: InstatusSubscriber,
  pageId?: number,
): {
  email: string;
  pageId?: number;
  confirmed: boolean;
  sourceComponentIds: string[];
} | null {
  if (!subscriber.email) return null;

  return {
    email: subscriber.email,
    pageId,
    confirmed: subscriber.confirmed ?? false,
    sourceComponentIds: subscriber.all
      ? []
      : (subscriber.components ?? []).map((c) => c.id),
  };
}
