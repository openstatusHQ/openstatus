import type {
  StatuspageComponent,
  StatuspageGroupComponent,
  StatuspageIncident,
  StatuspagePage,
  StatuspageSubscriber,
} from "./api-types";

export type StatusReportStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved";

export function mapPage(page: StatuspagePage, workspaceId: number) {
  return {
    workspaceId,
    title: page.name,
    description: page.page_description ?? "",
    slug: page.subdomain,
    customDomain: page.domain ?? "",
    published: true,
    icon: "",
  };
}

export function mapComponent(
  component: StatuspageComponent,
  workspaceId: number,
  pageId: number,
) {
  return {
    workspaceId,
    pageId,
    type: "static" as const,
    monitorId: null,
    name: component.name,
    description: component.description ?? null,
    order: component.position ?? 0,
  };
}

export function mapComponentGroup(
  group: StatuspageGroupComponent,
  workspaceId: number,
  pageId: number,
) {
  return {
    workspaceId,
    pageId,
    name: group.name,
  };
}

const INCIDENT_UPDATE_STATUS_MAP: Record<string, StatusReportStatus> = {
  investigating: "investigating",
  identified: "identified",
  monitoring: "monitoring",
  resolved: "resolved",
  scheduled: "investigating",
  in_progress: "investigating",
  verifying: "monitoring",
  completed: "resolved",
};

export function mapIncidentUpdateStatus(status: string): StatusReportStatus {
  return INCIDENT_UPDATE_STATUS_MAP[status] ?? "investigating";
}

export function isScheduledIncident(incident: StatuspageIncident): boolean {
  return incident.scheduled_for != null;
}

export function mapIncidentToStatusReport(
  incident: StatuspageIncident,
  workspaceId: number,
  pageId: number,
) {
  const updates = [...(incident.incident_updates ?? [])].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const mappedUpdates = updates.map((u) => ({
    status: mapIncidentUpdateStatus(u.status),
    message: u.body ?? "",
    date: new Date(u.created_at),
  }));

  if (incident.postmortem_body && mappedUpdates.length > 0) {
    const last = mappedUpdates[mappedUpdates.length - 1];
    last.message = `${last.message}\n\n---\n\n**Postmortem**\n\n${incident.postmortem_body}`;
  }

  const lastUpdate = updates[updates.length - 1];
  const reportStatus = lastUpdate
    ? mapIncidentUpdateStatus(lastUpdate.status)
    : "investigating";

  const sourceComponentIds: string[] = [];
  if (incident.components) {
    for (const comp of incident.components) {
      sourceComponentIds.push(comp.id);
    }
  }

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

export function mapIncidentToMaintenance(
  incident: StatuspageIncident,
  workspaceId: number,
  pageId: number,
) {
  const updates = incident.incident_updates ?? [];
  const message = updates.map((u) => u.body ?? "").join("\n");

  return {
    title: incident.name,
    message,
    from: new Date(incident.scheduled_for!),
    to: new Date(incident.scheduled_until!),
    workspaceId,
    pageId,
  };
}

export function mapSubscriber(
  subscriber: StatuspageSubscriber,
  pageId: number,
): {
  email: string;
  pageId: number;
  channelType: string;
  webhookUrl: string | null;
} | null {
  switch (subscriber.mode) {
    case "email":
      return {
        email: subscriber.email!,
        pageId,
        channelType: "email",
        webhookUrl: null,
      };
    case "webhook":
      return {
        email: "webhook@imported.openstatus.dev",
        pageId,
        channelType: "webhook",
        webhookUrl: subscriber.endpoint!,
      };
    default:
      return null;
  }
}
