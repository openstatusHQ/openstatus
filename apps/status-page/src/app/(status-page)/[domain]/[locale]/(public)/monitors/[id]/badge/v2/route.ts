import { db, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import type { NextRequest } from "next/server";

import { getQueryClient, trpc } from "@/lib/trpc/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MonitorStatus =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "under_maintenance"
  | "unknown";

const statusDictionary: Record<
  MonitorStatus,
  { label: string; hexColor: string }
> = {
  operational: {
    label: "Operational",
    hexColor: "#10b981",
  },
  degraded_performance: {
    label: "Degraded",
    hexColor: "#f59e0b",
  },
  partial_outage: {
    label: "Partial Outage",
    hexColor: "#f59e0b",
  },
  major_outage: {
    label: "Outage",
    hexColor: "#ef4444",
  },
  under_maintenance: {
    label: "Maintenance",
    hexColor: "#3b82f6",
  },
  unknown: {
    label: "Unknown",
    hexColor: "#6b7280",
  },
};

const SIZE: Record<
  string,
  {
    height: number;
    padding: number;
    gap: number;
    radius: number;
    fontSize: number;
  }
> = {
  sm: { height: 34, padding: 8, gap: 12, radius: 4, fontSize: 12 },
  md: { height: 46, padding: 8, gap: 12, radius: 4, fontSize: 14 },
  lg: { height: 56, padding: 12, gap: 16, radius: 6, fontSize: 16 },
  xl: { height: 68, padding: 12, gap: 16, radius: 6, fontSize: 18 },
};

function getTextWidth(text: string, fontSize: number): number {
  const monoCharWidthRatio = 0.6;
  return text.length * monoCharWidthRatio * fontSize;
}

function resolveMonitorStatus(status?: string): MonitorStatus {
  switch (status) {
    case "success":
    case "active":
    case "operational":
      return "operational";
    case "degraded":
    case "degraded_performance":
      return "degraded_performance";
    case "partial_outage":
      return "partial_outage";
    case "error":
    case "major_outage":
      return "major_outage";
    case "info":
    case "under_maintenance":
      return "under_maintenance";
    default:
      return "unknown";
  }
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ domain: string; id: string }> },
) {
  const { domain, id } = await props.params;
  const monitorId = Number.parseInt(id, 10);
  if (Number.isNaN(monitorId)) {
    return new Response("Invalid monitor ID", { status: 400 });
  }

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

  if (!row || row.accessType !== "public") {
    return new Response("Not Found", { status: 404 });
  }

  const data = await getQueryClient().fetchQuery(
    trpc.statusPage.get.queryOptions({ slug: row.slug }),
  );

  const monitor = data?.monitors.find((m) => m.id === monitorId);
  if (!monitor || !monitor.public) {
    return new Response("Monitor Not Found", { status: 404 });
  }

  const resolved = resolveMonitorStatus(monitor.status);
  const theme = req.nextUrl.searchParams.get("theme") ?? "light";
  const variant = req.nextUrl.searchParams.get("variant") ?? "default";
  const size = req.nextUrl.searchParams.get("size") ?? "sm";

  const { height, padding, gap, radius, fontSize } = SIZE[size] ?? SIZE.sm;
  const { label, hexColor } = statusDictionary[resolved];
  const textWidth = getTextWidth(label, fontSize);
  const width = Math.ceil(padding + textWidth + gap + radius * 2 + padding);

  const textColor = theme === "dark" ? "#d1d5db" : "#374151";
  const bgColor = theme === "dark" ? "#111827" : "#ffffff";
  const borderColor = variant === "outline" ? "#d1d5db" : "transparent";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="0.5" y="0.5" width="${width - 1}" height="${
      height - 1
    }" fill="${bgColor}" stroke="${borderColor}" stroke-width="1" rx="${radius}" ry="${radius}" />
      <text x="${padding}" y="50%" dominant-baseline="middle"
            font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace" font-size="${fontSize}" font-weight="600" fill="${textColor}">
        ${label}
      </text>
      <circle cx="${width - padding - radius}" cy="${
        height / 2
      }" r="${radius}" fill="${hexColor}"/>
    </svg>
  `;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=60, s-maxage=60",
    },
  });
}
