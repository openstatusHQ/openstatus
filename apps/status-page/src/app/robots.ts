import { db, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { getBaseUrl } from "../lib/base-url";
import { stripHostPort } from "../lib/domain";
import { resolveRoute } from "../lib/resolve-route";

// trpc/db lookup needs Node, matching the sitemap and other content routes.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headerStore = await headers();
  const host = stripHostPort(
    headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
  );

  // Only advertise a sitemap when the host resolves to a real page; the host
  // header is attacker-controlled, so resolve the page and build the sitemap URL
  // from its canonical base — never reflect the raw host (validating the slug
  // prefix alone lets a forged host like `acme.openstatus.dev.evil.com` through).
  const route = host
    ? resolveRoute({ host, urlHost: host, pathname: "/" })
    : null;
  const row = route
    ? await db
        .select({
          slug: page.slug,
          customDomain: page.customDomain,
          allowIndex: page.allowIndex,
        })
        .from(page)
        .where(
          sql`lower(${page.slug}) = ${route.prefix} OR lower(${page.customDomain}) = ${route.prefix}`,
        )
        .get()
    : undefined;

  // The page owner opted out of indexing: disallow everything and omit the
  // sitemap so crawlers have nothing to follow.
  if (row && !row.allowIndex) {
    return {
      rules: [
        {
          userAgent: "*",
          disallow: "/",
        },
      ],
    };
  }

  const sitemap = row
    ? `${getBaseUrl({ slug: row.slug, customDomain: row.customDomain ?? undefined })}/sitemap.xml`
    : undefined;

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
