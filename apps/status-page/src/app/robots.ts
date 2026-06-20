import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  // Point crawlers at this host's own sitemap so each tenant advertises only
  // its own pages.
  const sitemap = host ? `https://${host}/sitemap.xml` : undefined;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    ...(sitemap ? { sitemap } : {}),
  };
}
