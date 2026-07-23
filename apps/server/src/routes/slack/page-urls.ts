import { and, db, eq, inArray } from "@openstatus/db";
import { page, pageComponent } from "@openstatus/db/src/schema";

import { env } from "@/env";

/**
 * Slack-message URL helpers. Pure transport-layer formatting — lives here
 * (not in `@openstatus/services`) because status-page URL construction is
 * display-only and doesn't belong in the write-path service layer. Kept
 * separate from `interactions.ts` so that file stays clean of db imports
 * and can be covered by the Biome ban.
 */
export async function getPageUrl(pageId: number): Promise<string | null> {
  const statusPage = await db
    .select({ slug: page.slug, customDomain: page.customDomain })
    .from(page)
    .where(eq(page.id, pageId))
    .get();

  if (!statusPage) return null;
  return statusPage.customDomain
    ? `https://${statusPage.customDomain}`
    : `https://${statusPage.slug}.openstatus.dev`;
}

function getDashboardBaseUrl(): string {
  return env.NODE_ENV === "production"
    ? "https://app.openstatus.dev"
    : "http://localhost:3000";
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
  const statusPage = await db
    .select({ title: page.title })
    .from(page)
    .where(and(eq(page.workspaceId, workspaceId), eq(page.id, pageId)))
    .get();

  if (!statusPage) return null;
  return {
    title: statusPage.title,
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
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: pageComponent.id, name: pageComponent.name })
    .from(pageComponent)
    .where(
      and(
        eq(pageComponent.workspaceId, workspaceId),
        inArray(pageComponent.id, ids),
      ),
    )
    .all();
  return new Map(rows.map((r: { id: number; name: string }) => [r.id, r.name]));
}

export async function getReportUrl(
  pageId: number,
  reportId: number,
): Promise<string | null> {
  const statusPage = await db
    .select({ slug: page.slug, customDomain: page.customDomain })
    .from(page)
    .where(eq(page.id, pageId))
    .get();

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
