import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

import type { Status } from "@openstatus/react";
import { getStatus } from "@openstatus/react";

const statusDictionary: Record<Status, { label: string; color: string }> = {
  operational: {
    label: "Operational",
    color: "bg-green-500",
  },
  degraded_performance: {
    label: "Degraded Performance",
    color: "bg-yellow-500",
  },
  partial_outage: {
    label: "Partial Outage",
    color: "bg-yellow-500",
  },
  major_outage: {
    label: "Major Outage",
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
    label: "Under Maintenance",
    color: "bg-gray-500",
  },
} as const;

export async function GET(
  req: NextRequest,
  { params }: { params: { domain: string } },
) {
  const { status } = await getStatus(params.domain);
  const theme = req.nextUrl.searchParams.get("theme");

  const { label, color } = statusDictionary[status];

  const light = "border-gray-200 text-gray-700 bg-white";
  const dark = "border-gray-800 text-gray-300 bg-gray-900";

  return new ImageResponse(
    (
      <div
        tw={`flex max-w-fit items-center rounded-md border px-3 py-1 text-sm ${
          theme === "dark" ? dark : light
        }`}
      >
        {label}
        <div tw={`flex h-2 w-2 rounded-full ml-2 ${color}`} />
      </div>
    ),
  );
}
