import {
  listComponentEntries,
  sitemapIds,
  sitemapIndexXml,
} from "../../../lib/sitemap";

export const revalidate = 3600;

export async function GET() {
  const components = await listComponentEntries();
  return new Response(sitemapIndexXml(sitemapIds(components.length)), {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control":
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
}
