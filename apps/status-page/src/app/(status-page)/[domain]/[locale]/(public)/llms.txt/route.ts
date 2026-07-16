import { db, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { NextResponse } from "next/server";

import {
  escapeLinkLabel,
  type OverviewPage,
} from "../../../../../../content/markdown";
import { getBaseUrl } from "../../../../../../lib/base-url";
import { getQueryClient, trpc } from "../../../../../../lib/trpc/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound() {
  return new NextResponse("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function render({
  data,
  baseUrl,
}: {
  data: OverviewPage;
  baseUrl: string;
}): string {
  const now = Date.now();
  const sections = [
    `# ${data.title}`,
    "",
    `> ${data.description || "Operational status."} Agent-readable markdown, JSON, and feeds are linked below.`,
    "",
    "## Status",
    `- [Overview](${baseUrl}/.md): overall status, components, active incidents`,
    `- [Monitors](${baseUrl}/monitors.md): per-service status`,
    `- [Events](${baseUrl}/events.md): incident & maintenance history`,
  ];

  if (data.monitors.length > 0) {
    sections.push("", "## Monitors");
    for (const monitor of data.monitors) {
      sections.push(
        `- [${escapeLinkLabel(monitor.name)}](${baseUrl}/monitors/${monitor.id}.md)`,
      );
    }
  }

  const activeReports = data.statusReports.filter(
    (r) => r.status !== "resolved",
  );
  const activeMaintenance = data.maintenances.filter(
    (m) => m.to && new Date(m.to).getTime() >= now,
  );
  if (activeReports.length > 0 || activeMaintenance.length > 0) {
    sections.push("", "## Active incidents & maintenance");
    for (const report of activeReports) {
      sections.push(
        `- [${escapeLinkLabel(report.title)}](${baseUrl}/events/report/${report.id}.md)`,
      );
    }
    for (const maintenance of activeMaintenance) {
      sections.push(
        `- [${escapeLinkLabel(maintenance.title)}](${baseUrl}/events/maintenance/${maintenance.id}.md)`,
      );
    }
  }

  sections.push(
    "",
    "## Data",
    `- [summary.json](${baseUrl}/api/status/summary.json): machine summary, Statuspage-compatible`,
    `- [current.json](${baseUrl}/api/status/current.json): single overall indicator — cheapest "is it up?"`,
    `- [Unresolved incidents](${baseUrl}/api/status/incidents.json)`,
    `- [RSS](${baseUrl}/feed/rss) · [Atom](${baseUrl}/feed/atom) · [JSON feed](${baseUrl}/feed/json)`,
    "",
    "## Notes",
    "- Any page URL also serves markdown via a `.md` suffix or `Accept: text/markdown`.",
    "",
  );

  return sections.join("\n");
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ domain: string }> },
) {
  const { domain } = await props.params;
  const prefix = domain.toLowerCase();

  const row = await db
    .select({
      slug: page.slug,
      accessType: page.accessType,
    })
    .from(page)
    .where(
      sql`lower(${page.slug}) = ${prefix} OR lower(${page.customDomain}) = ${prefix}`,
    )
    .get();
  if (!row) return notFound();
  // Only public pages get a discovery doc — don't leak title/description of
  // password/email/IP-gated pages. Gate on the cheap row before the full fetch.
  if (row.accessType !== "public") return notFound();

  const data = await getQueryClient().fetchQuery(
    trpc.statusPage.get.queryOptions({ slug: row.slug }),
  );
  if (!data) return notFound();

  const baseUrl = getBaseUrl({
    slug: data.slug,
    customDomain: data.customDomain ?? undefined,
  });

  return new NextResponse(render({ data, baseUrl }), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
    },
  });
}
