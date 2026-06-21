import { db, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { stripHostPort } from "@/lib/domain";
import { resolveRoute } from "@/lib/resolve-route";

// trpc/db lookup needs Node, matching the sitemap and other content routes.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headerStore = await headers();
  const host = stripHostPort(
    headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
  );

  // Only advertise a sitemap when the host resolves to a real page; the host
  // header is attacker-controlled, so never emit it back to crawlers unverified.
  const route = host
    ? resolveRoute({ host, urlHost: host, pathname: "/" })
    : null;
  const row = route
    ? await db
        .select({ slug: page.slug })
        .from(page)
        .where(
          sql`lower(${page.slug}) = ${route.prefix} OR lower(${page.customDomain}) = ${route.prefix}`,
        )
        .get()
    : undefined;
  const sitemap = row ? `https://${host}/sitemap.xml` : undefined;

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
