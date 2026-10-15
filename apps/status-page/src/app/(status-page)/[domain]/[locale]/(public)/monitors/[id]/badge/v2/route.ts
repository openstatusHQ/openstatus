import type { NextRequest } from "next/server";

import {
  getPublicMonitorForBadge,
  getTextWidth,
  parseMonitorId,
  resolveBadgeSize,
  resolveMonitorStatus,
  svgStatusDictionary,
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
  const theme = req.nextUrl.searchParams.get("theme") ?? "light";
  const variant = req.nextUrl.searchParams.get("variant") ?? "default";
  const size = req.nextUrl.searchParams.get("size");

  const { height, padding, gap, radius, fontSize } = resolveBadgeSize(size);
  const { label, hexColor } = svgStatusDictionary[resolved];
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
