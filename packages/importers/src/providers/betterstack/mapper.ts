import type {
  BetterstackIncident,
  BetterstackMonitor,
  BetterstackMonitorGroup,
  BetterstackStatusPage,
  BetterstackStatusPageResource,
  BetterstackStatusPageSection,
  BetterstackStatusReport,
  BetterstackStatusUpdate,
} from "./api-types";

export type StatusReportStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved";

const FREQUENCY_MAP: Record<number, string> = {
  30: "30s",
  60: "1m",
  120: "1m",
  180: "5m",
  300: "5m",
  600: "10m",
  1800: "30m",
  3600: "1h",
};

const REGION_MAP: Record<string, string> = {
  us: "iad",
  eu: "fra",
  as: "sin",
  au: "syd",
};

const MONITOR_TYPE_MAP: Record<string, string> = {
  status: "http",
  keyword: "http",
  expected_status_code: "http",
  tcp: "tcp",
  udp: "udp",
  ping: "http",
  ping_icmp: "http",
  dns: "dns",
  smtp: "http",
  pop: "http",
  imap: "http",
};

const INCIDENT_STATUS_MAP: Record<string, StatusReportStatus> = {
  started: "investigating",
  acknowledged: "identified",
  resolved: "resolved",
};

export function mapFrequency(seconds: number): string {
  if (FREQUENCY_MAP[seconds]) return FREQUENCY_MAP[seconds];
  // Snap to nearest supported value
  const supported = [30, 60, 300, 600, 1800, 3600];
  let closest = supported[0];
  for (const s of supported) {
    if (Math.abs(s - seconds) < Math.abs(closest - seconds)) {
      closest = s;
    }
  }
  return FREQUENCY_MAP[closest] ?? "10m";
}

export function mapRegions(regions: string[]): string {
  const mapped = regions
    .map((r) => REGION_MAP[r])
    .filter((r): r is string => r != null);
  return mapped.length > 0 ? mapped.join(",") : "iad";
}

export function mapMonitorType(type: string): string {
  return MONITOR_TYPE_MAP[type] ?? "http";
}

export function mapMethod(method: string): string {
  return method.toUpperCase();
}

export function mapMonitor(monitor: BetterstackMonitor, workspaceId: number) {
  const attrs = monitor.attributes;

  const headers =
    attrs.request_headers.length > 0
      ? JSON.stringify(
          attrs.request_headers.map((h) => ({
            key: h.name,
            value: h.value,
          })),
        )
      : "";

  return {
    workspaceId,
    jobType: mapMonitorType(attrs.monitor_type),
    periodicity: mapFrequency(attrs.check_frequency),
    status: "active" as const,
    active: attrs.status !== "paused",
    regions: mapRegions(attrs.regions),
    url: attrs.url,
    name: attrs.pronounceable_name,
    description: "",
    headers,
    body: attrs.request_body,
    method: mapMethod(attrs.http_method),
    timeout: attrs.request_timeout * 1000,
  };
}

export function mapMonitorGroup(
  group: BetterstackMonitorGroup,
  workspaceId: number,
  pageId?: number,
) {
  return {
    workspaceId,
    pageId,
    name: group.attributes.name,
  };
}

export function mapStatusPage(
  page: BetterstackStatusPage,
  workspaceId: number,
) {
  return {
    workspaceId,
    title: page.attributes.company_name,
    description: "",
    slug: page.attributes.subdomain,
    customDomain: page.attributes.custom_domain ?? "",
    published: true,
    icon: "",
  };
}

export function mapSection(
  section: BetterstackStatusPageSection,
  workspaceId: number,
  pageId?: number,
) {
  return {
    workspaceId,
    pageId,
    name: section.attributes.name,
  };
}

export function mapResource(
  resource: BetterstackStatusPageResource,
  workspaceId: number,
  pageId?: number,
) {
  return {
    workspaceId,
    pageId,
    type: "static" as const,
    monitorId: null,
    name: resource.attributes.public_name,
    description: resource.attributes.explanation ?? null,
    order: resource.attributes.position,
    sourceGroupId: resource.attributes.status_page_section_id
      ? String(resource.attributes.status_page_section_id)
      : null,
  };
}

const REPORT_STATUS_MAP: Record<string, StatusReportStatus> = {
  operational: "resolved",
  resolved: "resolved",
  downtime: "investigating",
  degraded: "identified",
  maintenance: "monitoring",
};

export function mapReportAggregateState(
  state: string | null,
): StatusReportStatus {
  if (!state) return "investigating";
  return REPORT_STATUS_MAP[state.toLowerCase()] ?? "investigating";
}

export function mapReportToStatusReport(
  report: BetterstackStatusReport,
  updates: BetterstackStatusUpdate[],
  workspaceId: number,
  pageId?: number,
) {
  const sortedUpdates = [...updates].sort(
    (a, b) =>
      new Date(a.attributes.published_at).getTime() -
      new Date(b.attributes.published_at).getTime(),
  );

  const mappedUpdates = sortedUpdates.map((u) => {
    const aggregateStatus =
      u.attributes.affected_resources.length > 0
        ? mapReportAggregateState(u.attributes.affected_resources[0].status)
        : "investigating";
    return {
      status: aggregateStatus,
      message: u.attributes.message ?? "",
      date: new Date(u.attributes.published_at),
    };
  });

  // If no updates, create a synthetic one from the report itself
  if (mappedUpdates.length === 0 && report.attributes.starts_at) {
    mappedUpdates.push({
      status: mapReportAggregateState(report.attributes.aggregate_state),
      message: report.attributes.title,
      date: new Date(report.attributes.starts_at),
    });
  }

  const lastUpdate = mappedUpdates[mappedUpdates.length - 1];
  const reportStatus = lastUpdate?.status ?? "investigating";

  const sourceComponentIds = report.attributes.affected_resources.map(
    (r) => r.status_page_resource_id,
  );

  return {
    report: {
      title: report.attributes.title,
      status: reportStatus,
      workspaceId,
      pageId,
    },
    updates: mappedUpdates,
    sourceComponentIds,
  };
}

export function mapReportToMaintenance(
  report: BetterstackStatusReport,
  updates: BetterstackStatusUpdate[],
  workspaceId: number,
  pageId?: number,
) {
  const from = report.attributes.starts_at
    ? new Date(report.attributes.starts_at)
    : new Date();
  const to = report.attributes.ends_at
    ? new Date(report.attributes.ends_at)
    : from;

  const sortedUpdates = [...updates].sort(
    (a, b) =>
      new Date(a.attributes.published_at).getTime() -
      new Date(b.attributes.published_at).getTime(),
  );

  const message = sortedUpdates
    .map((u) => u.attributes.message ?? "")
    .filter(Boolean)
    .join("\n");

  const sourceComponentIds = report.attributes.affected_resources.map(
    (r) => r.status_page_resource_id,
  );

  return {
    title: report.attributes.title,
    message: message || report.attributes.title,
    from,
    to,
    workspaceId,
    pageId,
    sourceComponentIds,
  };
}

export function mapIncidentStatus(status: string): StatusReportStatus {
  return INCIDENT_STATUS_MAP[status] ?? "investigating";
}

export function mapIncidentToStatusReport(
  incident: BetterstackIncident,
  workspaceId: number,
  pageId?: number,
) {
  const attrs = incident.attributes;
  const updates: Array<{
    status: StatusReportStatus;
    message: string;
    date: Date;
  }> = [];

  // Create synthetic updates from timestamps
  updates.push({
    status: "investigating",
    message: attrs.cause ?? `Incident detected on ${attrs.url ?? "monitor"}`,
    date: new Date(attrs.started_at),
  });

  if (attrs.acknowledged_at) {
    updates.push({
      status: "identified",
      message: "Incident acknowledged",
      date: new Date(attrs.acknowledged_at),
    });
  }

  if (attrs.resolved_at) {
    updates.push({
      status: "resolved",
      message: "Incident resolved",
      date: new Date(attrs.resolved_at),
    });
  }

  const lastUpdate = updates[updates.length - 1];
  const reportStatus = lastUpdate?.status ?? "investigating";

  return {
    report: {
      title: attrs.name ?? `Incident on ${attrs.url ?? "monitor"}`,
      status: reportStatus,
      workspaceId,
      pageId,
    },
    updates,
    sourceComponentIds: [] as string[],
  };
}
