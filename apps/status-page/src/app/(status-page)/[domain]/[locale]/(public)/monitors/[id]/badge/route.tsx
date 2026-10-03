import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import {
  BADGE_SIZE,
  getPublicMonitorForBadge,
  parseMonitorId,
  pngStatusDictionary,
  resolveMonitorStatus,
} from "@/lib/monitor-badge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ domain: string; id: string }> },
) {
  const { domain, id } = await props.params;
  const monitorId = parseMonitorId(id);
  if (monitorId === null) {
    return new Response("Invalid monitor ID", { status: 400 });
  }

  const monitor = await getPublicMonitorForBadge(domain, monitorId);
  if (!monitor) {
    return new Response("Not Found", { status: 404 });
  }

  const resolved = resolveMonitorStatus(monitor.status);
  const theme = req.nextUrl.searchParams.get("theme");
  const size = req.nextUrl.searchParams.get("size");
  const s = BADGE_SIZE[size ?? "sm"] ?? BADGE_SIZE.sm;
  const { label, color } = pngStatusDictionary[resolved];
  const light = "border-gray-200 text-gray-700 bg-white";
  const dark = "border-gray-800 text-gray-300 bg-gray-900";

  return new ImageResponse(
    <div
      tw={`flex items-center justify-center rounded-md border px-3 py-1 ${s.textSize} ${
        theme === "dark" ? dark : light
      }`}
      style={{ width: s.width, height: s.height }}
    >
      {label}
      <div tw={`flex h-2 w-2 rounded-full ml-2 ${color}`} />
    </div>,
    { width: s.width, height: s.height },
  );
}
