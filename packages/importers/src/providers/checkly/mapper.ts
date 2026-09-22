import type {
  ChecklyCheck,
  ChecklyIncident,
  ChecklyMaintenanceWindow,
  ChecklyService,
  ChecklyStatusPage,
} from "./api-types";

export type StatusReportStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved";

/**
 * Checkly check types OpenStatus can run as monitors. Browser / Playwright /
 * multi-step / heartbeat / gRPC / traceroute / agentic have no HTTP-family
 * monitor equivalent and are skipped with a reason by the provider.
 */
const CHECK_TYPE_MAP: Record<string, string> = {
  API: "http",
  URL: "http",
  TCP: "tcp",
  ICMP: "icmp",
  DNS: "dns",
  SSL: "ssl",
};

export function mapCheckType(checkType: string): string | null {
  return CHECK_TYPE_MAP[checkType.toUpperCase()] ?? null;
}

const FREQUENCY_MAP: Record<number, string> = {
  0: "30s",
  1: "1m",
  2: "1m",
  5: "5m",
  10: "10m",
  15: "10m",
  30: "30m",
  60: "1h",
};

// OpenStatus caps schedulable periodicity at 1h; longer Checkly frequencies
// (120/180/720/1440 min) snap down to the nearest supported bucket.
export function mapFrequency(minutes: number): string {
  if (FREQUENCY_MAP[minutes]) return FREQUENCY_MAP[minutes];
  const supported = Object.keys(FREQUENCY_MAP).map(Number);
  let closest = supported[0];
  for (const s of supported) {
    if (Math.abs(s - minutes) < Math.abs(closest - minutes)) closest = s;
  }
  return FREQUENCY_MAP[closest] ?? "10m";
}

// AWS region codes (Checkly locations) → Fly regions (OpenStatus).
const REGION_MAP: Record<string, string> = {
  "us-east-1": "iad",
  "us-east-2": "iad",
  "us-west-1": "sjc",
  "us-west-2": "sea",
  "ca-central-1": "yul",
  "eu-west-1": "lhr",
  "eu-west-2": "lhr",
  "eu-west-3": "cdg",
  "eu-central-1": "fra",
  "eu-north-1": "arn",
  "ap-south-1": "bom",
  "ap-southeast-1": "sin",
  "ap-southeast-2": "syd",
  "ap-northeast-1": "nrt",
  "ap-northeast-2": "nrt",
  "sa-east-1": "gru",
  "af-south-1": "jnb",
};

export function mapRegions(locations: string[]): string {
  const mapped = Array.from(
    new Set(
      locations
        .map((l) => REGION_MAP[l.toLowerCase()])
        .filter((r): r is string => r != null),
    ),
  );
  return mapped.length > 0 ? mapped.join(",") : "iad";
}

const ALLOWED_METHODS = new Set([
  "GET",
  "POST",
  "HEAD",
  "PUT",
  "PATCH",
  "DELETE",
  "TRACE",
  "CONNECT",
  "OPTIONS",
]);

export function mapMethod(method: string): string {
  const upper = method.toUpperCase();
  return ALLOWED_METHODS.has(upper) ? upper : "GET";
}

export function mapCheck(check: ChecklyCheck, workspaceId: number) {
  const req = check.request;
  const headers =
    req && req.headers.length > 0
      ? JSON.stringify(req.headers.map((h) => ({ key: h.key, value: h.value })))
      : "";

  return {
    workspaceId,
    jobType: mapCheckType(check.checkType) ?? "http",
    periodicity: mapFrequency(check.frequency),
    status: "active" as const,
    // Checkly `muted` only silences alerts — the check keeps running — so it
    // must not disable the monitor; only `activated` controls whether it runs.
    active: check.activated,
    regions: mapRegions(check.locations),
    url: req?.url ?? "",
    name: check.name,
    description: "",
    headers,
    body: req?.body ?? "",
    method: mapMethod(req?.method ?? "GET"),
    // Checkly maxResponseTime is the hard timeout (ms); default to 45s.
    timeout: check.maxResponseTime ?? 45000,
    sourceMonitorGroupId: check.groupId,
  };
}

// url may be a full URL or a bare subdomain; reduce it to a slug token.
export function deriveSlug(input: string): string {
  const withoutScheme = input.replace(/^https?:\/\//, "");
  const host = withoutScheme.split("/")[0] ?? withoutScheme;
  const firstLabel = host.split(".")[0] ?? host;
  const slug = firstLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "status";
}

export function mapPage(page: ChecklyStatusPage, workspaceId: number) {
  return {
    workspaceId,
    title: page.name,
    description: page.description,
    slug: deriveSlug(page.url || page.name),
    customDomain: page.customDomain ?? "",
    published: !page.isPrivate,
    icon: page.logo ?? "",
  };
}

export function mapCard(
  card: { id: string; name: string },
  workspaceId: number,
  pageId?: number,
) {
  return { workspaceId, pageId, name: card.name };
}

export function mapService(
  service: ChecklyService,
  workspaceId: number,
  order: number,
  cardId: string,
  pageId?: number,
) {
  return {
    workspaceId,
    pageId,
    type: "static" as const,
    monitorId: null as number | null,
    name: service.name,
    description: null as string | null,
    order,
    sourceGroupId: cardId,
  };
}

const INCIDENT_STATUS_MAP: Record<string, StatusReportStatus> = {
  investigating: "investigating",
  identified: "identified",
  monitoring: "monitoring",
  resolved: "resolved",
};

export function mapIncidentStatus(
  status: string | null | undefined,
): StatusReportStatus {
  if (!status) return "investigating";
  return INCIDENT_STATUS_MAP[status.toLowerCase()] ?? "investigating";
}

export function mapIncidentToStatusReport(
  incident: ChecklyIncident,
  workspaceId: number,
  pageId?: number,
) {
  const sorted = [...incident.incidentUpdates].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const updates = sorted.map((u) => ({
    status: mapIncidentStatus(u.status ?? u.incidentUpdateStatus),
    message: u.description ?? u.text ?? "",
    date: new Date(u.created_at),
  }));

  // No updates → synthesize one so the report still has a timeline entry.
  if (updates.length === 0) {
    updates.push({
      status: mapIncidentStatus(incident.lastUpdateStatus),
      message: incident.name,
      date: new Date(incident.created_at ?? new Date().toISOString()),
    });
  }

  const reportStatus = incident.lastUpdateStatus
    ? mapIncidentStatus(incident.lastUpdateStatus)
    : (updates[updates.length - 1]?.status ?? "investigating");

  return {
    report: {
      title: incident.name,
      status: reportStatus,
      workspaceId,
      pageId,
    },
    updates,
    sourceComponentIds: incident.services.map((s) => s.id),
  };
}

export function mapMaintenance(
  mw: ChecklyMaintenanceWindow,
  workspaceId: number,
  pageId?: number,
) {
  return {
    title: mw.name,
    message: mw.description ?? mw.name,
    from: new Date(mw.startsAt),
    to: new Date(mw.endsAt),
    workspaceId,
    pageId,
    // Checkly ties maintenance windows to checks by tag, not to status-page
    // services — there's no clean component link to carry over.
    sourceComponentIds: [] as string[],
  };
}
