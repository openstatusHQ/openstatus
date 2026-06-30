import { db, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { getBaseUrl } from "@/lib/base-url";
import { stripHostPort } from "@/lib/domain";
import { resolveRoute } from "@/lib/resolve-route";
import { getQueryClient, trpc } from "@/lib/trpc/server";

// One sitemap per host: a custom domain must never enumerate other tenants'
// pages. trpc httpBatchLink needs Node, matching the other content routes.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headerStore = await headers();
  const host = stripHostPort(
    headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
  );
  const route = resolveRoute({ host, urlHost: host ?? "", pathname: "/" });
  if (!route) return [];

  const row = await db
    .select({
      slug: page.slug,
      customDomain: page.customDomain,
      allowIndex: page.allowIndex,
      accessType: page.accessType,
    })
    .from(page)
    .where(
      sql`lower(${page.slug}) = ${route.prefix} OR lower(${page.customDomain}) = ${route.prefix}`,
    )
    .get();
  // Only public, indexable pages belong in a sitemap — gated content must not
  // be advertised to crawlers.
  if (!row || !row.allowIndex || row.accessType !== "public") return [];

  const data = await getQueryClient().fetchQuery(
    trpc.statusPage.get.queryOptions({ slug: row.slug }),
  );
  if (!data) return [];

  const baseUrl = getBaseUrl({
    slug: data.slug,
    customDomain: data.customDomain ?? undefined,
  });
  const lastModified = data.updatedAt ?? undefined;

  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified },
    { url: `${baseUrl}/events`, lastModified },
  ];

  if (data.monitors.length > 0) {
    entries.push({ url: `${baseUrl}/monitors`, lastModified });
  }

  for (const monitor of data.monitors) {
    entries.push({ url: `${baseUrl}/monitors/${monitor.id}`, lastModified });
  }
  for (const report of data.statusReports) {
    entries.push({
      url: `${baseUrl}/events/report/${report.id}`,
      lastModified,
    });
  }
  for (const maintenance of data.maintenances) {
    entries.push({
      url: `${baseUrl}/events/maintenance/${maintenance.id}`,
      lastModified,
    });
  }

  return entries;
}
