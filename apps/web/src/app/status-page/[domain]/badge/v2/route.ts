import type { NextRequest } from "next/server";

import type { Status } from "@openstatus/react";
import { getStatus } from "@openstatus/react";

const statusDictionary: Record<Status, { label: string; hexColor: string }> = {
  operational: {
    label: "All Systems Operational",
    hexColor: "#10b981",
  },
  degraded_performance: {
    label: "Degraded Performance",
    hexColor: "#f59e0b",
  },
  partial_outage: {
    label: "Partial Outage",
    hexColor: "#f59e0b",
  },
  major_outage: {
    label: "Major Outage",
    hexColor: "#ef4444",
  },
  unknown: {
    label: "Unknown",
    hexColor: "#6b7280",
  },
  incident: {
    label: "Ongoing Incident",
    hexColor: "#f59e0b",
  },
  under_maintenance: {
    label: "Under Maintenance",
    hexColor: "#3b82f6",
  },
} as const;

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

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ domain: string }> },
) {
  const params = await props.params;
  const { status } = await getStatus(params.domain);
  const theme = req.nextUrl.searchParams.get("theme") ?? "light";
  const variant = req.nextUrl.searchParams.get("variant") ?? "default";
  const size = req.nextUrl.searchParams.get("size") ?? "sm";

  const { height, padding, gap, radius, fontSize } = SIZE[size] ?? SIZE.sm;
  const { label, hexColor } = statusDictionary[status];
  const textWidth = getTextWidth(label, fontSize);
  const width = Math.ceil(padding + textWidth + gap + radius * 2 + padding);

  const textColor = theme === "dark" ? "#d1d5db" : "#374151";
  const bgColor = theme === "dark" ? "#111827" : "#ffffff";
  const borderColor = variant === "outline" ? "#d1d5db" : "transparent";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="0.5" y="0.5" width="${width - 1}" height="${
      height - 1
    }"  fill="${bgColor}" stroke="${borderColor}" stroke-width="1" rx="${radius}" ry="${radius}" />
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
    headers: { "Content-Type": "image/svg+xml" },
  });
}
