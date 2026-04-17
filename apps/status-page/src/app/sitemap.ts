import { db, eq } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages = await db
    .select({
      slug: page.slug,
      customDomain: page.customDomain,
      updatedAt: page.updatedAt,
    })
    .from(page)
    .where(eq(page.allowIndex, true))
    .all();

  return pages.map((p) => {
    const url = p.customDomain
      ? `https://${p.customDomain}`
      : `https://${p.slug}.openstatus.dev`;
    return { url, lastModified: p.updatedAt ?? undefined };
  });
}
