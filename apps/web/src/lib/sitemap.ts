import { listLiveComponentSlugs } from "@openstatus/services/external-service-component";
import type { MetadataRoute } from "next";

import {
  cachedListExternalServices,
  cachedListRecentlyFetchedServiceIds,
} from "./external-service-cache";

export const SITE_URL = "https://www.openstatus.dev";

// The sitemap protocol caps a file at 50,000 URLs; stay well under it.
export const COMPONENTS_PER_SITEMAP = 40_000;
export const PAGES_SITEMAP_ID = "pages";
const COMPONENTS_SITEMAP_PREFIX = "components-";

export function sitemapIds(componentCount: number): string[] {
  const chunks = Math.ceil(componentCount / COMPONENTS_PER_SITEMAP);
  return [
    PAGES_SITEMAP_ID,
    ...Array.from(
      { length: chunks },
      (_, i) => `${COMPONENTS_SITEMAP_PREFIX}${i}`,
    ),
  ];
}

export function componentChunkIndex(id: string): number | null {
  if (!id.startsWith(COMPONENTS_SITEMAP_PREFIX)) return null;
  const digits = id.slice(COMPONENTS_SITEMAP_PREFIX.length);
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

export function componentChunk<T>(entries: T[], chunk: number): T[] {
  const start = chunk * COMPONENTS_PER_SITEMAP;
  return entries.slice(start, start + COMPONENTS_PER_SITEMAP);
}

export function sitemapUrl(id: string): string {
  return `${SITE_URL}/sitemap/${id}.xml`;
}

export function sitemapIndexXml(ids: string[]): string {
  const entries = ids
    .map((id) => `<sitemap>\n<loc>${sitemapUrl(id)}</loc>\n</sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}

export async function listLiveServices() {
  const services = await cachedListExternalServices();
  return services
    .filter((s) => s.deletedAt == null)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

// Sorted by service, so a component stays in the same file between rebuilds.
export async function listComponentEntries(): Promise<MetadataRoute.Sitemap> {
  const today = new Date().toISOString().slice(0, 10);
  const components = await listLiveComponentSlugs({
    externalServiceIds: await cachedListRecentlyFetchedServiceIds(),
  });
  return components.map((c) => ({
    url: `${SITE_URL}/status/${c.serviceSlug}/${c.componentSlug}`,
    lastModified: today,
    changeFrequency: "hourly" as const,
    priority: 0.6,
  }));
}
