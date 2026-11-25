import {
  incidentDashboardUrl,
  resolveDashboardUrl,
} from "@openstatus/services/incident";
import {
  getPagePublicDomain,
  getPageTitleInWorkspace,
} from "@openstatus/services/page";
import { getPageComponentNames } from "@openstatus/services/page-component";
import { getStatusReportTitleInWorkspace } from "@openstatus/services/status-report";

import { env } from "@/env";

/**
 * Slack-message URL helpers. Status-page URL construction is display-only, so
 * it stays in the transport; tests swap this module out via the import map.
 */
export async function getPageUrl(pageId: number): Promise<string | null> {
  const statusPage = await getPagePublicDomain(pageId);

  if (!statusPage) return null;
  return statusPage.customDomain
    ? `https://${statusPage.customDomain}`
    : `https://${statusPage.slug}.openstatus.dev`;
}

function getDashboardBaseUrl(): string {
  return resolveDashboardUrl({
    nodeEnv: env.NODE_ENV,
    override: env.DASHBOARD_URL,
  });
}

export function getIncidentDashboardUrl(incidentId: number): string {
  return incidentDashboardUrl(getDashboardBaseUrl(), incidentId);
}

/**
 * Resolve a page id to its dashboard link — the page title plus the internal
 * dashboard URL (not the public status page). Scoped to the workspace so a
 * spoofed id from another workspace never leaks its title into the preview
 * card (pageId on the draft is only validated against the workspace at execute
 * time). Returns null when the page doesn't exist in the workspace so callers
 * can fall back to the raw id.
 */
export async function getPageDashboardLink(
  workspaceId: number,
  pageId: number,
): Promise<{ title: string; url: string } | null> {
  const title = await getPageTitleInWorkspace({ workspaceId, pageId });

  if (title === null) return null;
  return {
    title,
    url: `${getDashboardBaseUrl()}/status-pages/${pageId}`,
  };
}

/**
 * Resolve page-component ids to their names, scoped to the workspace so a
 * spoofed id from another workspace never leaks a name. Missing ids are
 * simply absent from the map — callers fall back to the raw id.
 */
export async function getComponentNames(
  workspaceId: number,
  ids: number[],
): Promise<Map<number, string>> {
  return getPageComponentNames({ workspaceId, ids });
}

export async function getReportUrl(
  pageId: number,
  reportId: number,
): Promise<string | null> {
  const statusPage = await getPagePublicDomain(pageId);

  // Mirror `getPageUrl`'s null-on-missing contract. Previously a missing
  // page row produced `https://undefined.openstatus.dev/events/report/…`
  // (because `statusPage?.slug` was undefined). Every existing caller
  // already guards with `reportUrl ? … : …`, so returning `null` here
  // is drop-in safe and keeps the two helpers symmetric.
  if (!statusPage) return null;
  const baseUrl = statusPage.customDomain
    ? `https://${statusPage.customDomain}`
    : `https://${statusPage.slug}.openstatus.dev`;
  return `${baseUrl}/events/report/${reportId}`;
}

/**
 * Resolve a status report id to its title and public URL for the approval
 * card, scoped to the workspace so a spoofed id from another workspace never
 * leaks its title. Returns null when the report doesn't exist in the workspace.
 */
export async function getStatusReportLink(
  workspaceId: number,
  statusReportId: number,
): Promise<{ title: string; url: string | null } | null> {
  const report = await getStatusReportTitleInWorkspace({
    workspaceId,
    statusReportId,
  });

  if (!report) return null;
  const url = report.pageId
    ? await getReportUrl(report.pageId, statusReportId)
    : null;
  return { title: report.title, url };
}
