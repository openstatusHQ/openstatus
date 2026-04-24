import { db, eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";

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
