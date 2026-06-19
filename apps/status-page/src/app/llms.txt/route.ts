import { db, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { type NextRequest, NextResponse } from "next/server";

import { getBaseUrl } from "@/lib/base-url";
import { resolveRoute } from "@/lib/resolve-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function render({
  title,
  description,
  baseUrl,
}: {
  title: string;
  description: string | null;
  baseUrl: string;
}): string {
  return `# ${title}

> ${description || "Operational status."} Agent-readable markdown, JSON, and feeds are linked below.

## Status
- [Overview](${baseUrl}/.md): overall status, components, active incidents
- [Monitors](${baseUrl}/monitors.md): per-service status
- [Events](${baseUrl}/events.md): incident & maintenance history

## Data
- [summary.json](${baseUrl}/api/status/summary.json): machine summary, Statuspage-compatible
- [current.json](${baseUrl}/api/status/current.json): single overall indicator — cheapest "is it up?"
- [Unresolved incidents](${baseUrl}/api/status/incidents.json)
- [RSS](${baseUrl}/feed/rss) · [Atom](${baseUrl}/feed/atom) · [JSON feed](${baseUrl}/feed/json)

## Notes
- Any page URL also serves markdown via a \`.md\` suffix or \`Accept: text/markdown\`.
`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host");
  const route = resolveRoute({ host, urlHost: url.host, pathname: "/" });
  if (!route) return notFound();

  const row = await db
    .select({
      slug: page.slug,
      customDomain: page.customDomain,
      title: page.title,
      description: page.description,
    })
    .from(page)
    .where(
      sql`lower(${page.slug}) = ${route.prefix} OR lower(${page.customDomain}) = ${route.prefix}`,
    )
    .get();
  if (!row) return notFound();

  const baseUrl = getBaseUrl({
    slug: row.slug,
    customDomain: row.customDomain ?? undefined,
  });

  return new NextResponse(
    render({ title: row.title, description: row.description, baseUrl }),
    {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    },
  );
}
