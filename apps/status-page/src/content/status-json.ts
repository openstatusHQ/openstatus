import type { RouterOutputs } from "@openstatus/api";

import {
  componentStatus,
  flattenComponents,
  isoOrNull,
  pageIndicator,
} from "./status-vocab";

type Page = NonNullable<RouterOutputs["statusPage"]["get"]>;

export type StatusEndpoint = "summary" | "status" | "incidents";

const ENDPOINTS: Record<string, StatusEndpoint> = {
  "summary.json": "summary",
  "current.json": "status",
  "incidents.json": "incidents",
};

/**
 * The endpoint is always the last path segment; an optional leading segment is a
 * path-based slug (`/{slug}/summary.json`), mirroring the markdown route. Returns
 * null for unknown shapes so the handler can 404.
 */
export function matchEndpoint(
  path: string[],
): { endpoint: StatusEndpoint; slug: string | null } | null {
  if (path.length === 0 || path.length > 2) return null;
  const endpoint = ENDPOINTS[path[path.length - 1]];
  if (!endpoint) return null;
  return { endpoint, slug: path.length === 2 ? path[0] : null };
}

function pageBlock(page: Page, baseUrl: string) {
  return {
    name: page.title,
    url: baseUrl,
    updated_at: isoOrNull(page.updatedAt),
  };
}

/** `current.json` (Statuspage `status.json` shape) — the cheapest "is it up?" payload. */
export function toStatus(page: Page, baseUrl: string) {
  return {
    page: pageBlock(page, baseUrl),
    status: pageIndicator(page.status),
  };
}

function unresolvedIncidents(page: Page) {
  return page.statusReports
    .filter((report) => report.status !== "resolved")
    .map((report) => ({
      id: String(report.id),
      name: report.title,
      // openstatus report statuses already match Statuspage's incident enum.
      status: report.status,
      updated_at: isoOrNull(
        report.statusReportUpdates[0]?.date ?? report.createdAt,
      ),
      incident_updates: report.statusReportUpdates.map((update) => ({
        status: update.status,
        body: update.message,
        created_at: isoOrNull(update.date),
      })),
    }));
}

// `completed` is intentionally absent: scheduledMaintenances only feeds windows
// with `to >= now`, so a window is always either upcoming or live.
function maintenanceState(
  from: Date | string | number,
  now: number,
): "scheduled" | "in_progress" {
  return now < new Date(from).getTime() ? "scheduled" : "in_progress";
}

function scheduledMaintenances(page: Page, now: number) {
  return page.maintenances
    .filter((m) => m.to && new Date(m.to).getTime() >= now)
    .map((m) => ({
      id: String(m.id),
      name: m.title,
      status: maintenanceState(m.from, now),
      scheduled_for: isoOrNull(m.from),
      scheduled_until: isoOrNull(m.to),
    }));
}

/** Statuspage `summary.json` — page status, components, active incidents/maintenance. */
export function toSummary(page: Page, baseUrl: string, now = Date.now()) {
  const components = flattenComponents(page.trackers).map((c) => ({
    name: c.name,
    status: componentStatus(c.status),
  }));
  return {
    page: pageBlock(page, baseUrl),
    status: pageIndicator(page.status),
    components,
    incidents: unresolvedIncidents(page),
    scheduled_maintenances: scheduledMaintenances(page, now),
  };
}

/** `incidents.json` (Statuspage `incidents/unresolved.json` shape). */
export function toUnresolvedIncidents(page: Page, baseUrl: string) {
  return {
    page: pageBlock(page, baseUrl),
    incidents: unresolvedIncidents(page),
  };
}
