import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

import type { Status } from "@openstatus/react";
import { getStatus } from "@openstatus/react";

// Keep the `label` size within a maximum of 'Operational' to stay within the `SIZE` restriction
const statusDictionary: Record<Status, { label: string; color: string }> = {
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
  incident: {
    label: "Incident",
    color: "bg-yellow-500",
  },
  under_maintenance: {
    label: "Maintenance",
    color: "bg-gray-500",
  },
} as const;

// const SIZE = { width: 120, height: 34 };
const SIZE: Record<string, { width: number; height: number }> = {
  sm: { width: 120, height: 34 },
  md: { width: 160, height: 46 },
  lg: { width: 200, height: 56 },
  xl: { width: 240, height: 68 },
};
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ domain: string }> },
) {
  const params = await props.params;
  const { status } = await getStatus(params.domain);
  const theme = req.nextUrl.searchParams.get("theme");
  const size = req.nextUrl.searchParams.get("size");
  let s = SIZE.sm;
  if (size) {
    if (SIZE[size]) {
      s = SIZE[size];
    }
  }
  const { label, color } = statusDictionary[status];
  const light = "border-gray-200 text-gray-700 bg-white";
  const dark = "border-gray-800 text-gray-300 bg-gray-900";

  return new ImageResponse(
    <div
      tw={`flex items-center justify-center rounded-md border px-3 py-1
        ${size === "sm" && "text-sm"}${size === "md" && "text-md"} ${
          size === "lg" && "text-lg"
        } ${size === "xl" && "text-xl"} ${!size && "text-sm"} ${
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
