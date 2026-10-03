import { db, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { ImageResponse } from "next/og";
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
  { label: string; color: string }
> = {
  operational: {
    label: "Operational",
    color: "bg-green-500",
  },
  degraded_performance: {
    label: "Degraded",
    color: "bg-yellow-500",
  },
  partial_outage: {
    label: "Outage",
    color: "bg-yellow-500",
  },
  major_outage: {
    label: "Outage",
    color: "bg-red-500",
  },
  unknown: {
    label: "Unknown",
    color: "bg-gray-500",
  },
  under_maintenance: {
    label: "Maintenance",
    color: "bg-blue-500",
  },
} as const;

const SIZE: Record<string, { width: number; height: number }> = {
  sm: { width: 120, height: 34 },
  md: { width: 160, height: 46 },
  lg: { width: 200, height: 56 },
  xl: { width: 240, height: 68 },
};

const TEXT_SIZE: Record<string, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-xl",
};

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
  const theme = req.nextUrl.searchParams.get("theme");
  const size = req.nextUrl.searchParams.get("size");
  const s = SIZE[size ?? "sm"] ?? SIZE.sm;
  const textSize = TEXT_SIZE[size ?? "sm"] ?? TEXT_SIZE.sm;
  const { label, color } = statusDictionary[resolved];
  const light = "border-gray-200 text-gray-700 bg-white";
  const dark = "border-gray-800 text-gray-300 bg-gray-900";

  return new ImageResponse(
    <div
      tw={`flex items-center justify-center rounded-md border px-3 py-1 ${textSize} ${
        theme === "dark" ? dark : light
      }`}
      style={{ ...s }}
    >
      {label}
      <div tw={`flex h-2 w-2 rounded-full ml-2 ${color}`} />
    </div>,
    { ...s },
  );
}
