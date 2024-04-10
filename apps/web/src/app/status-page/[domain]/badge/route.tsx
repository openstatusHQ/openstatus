import { ImageResponse } from "next/og";

import type { Status, StatusResponse } from "@openstatus/react";

import {
  calSemiBold,
  interLight,
  interMedium,
  interRegular,
} from "../../../api/og/utils";

export const statusDictionary: Record<
  Status,
  { label: string; color: string }
> = {
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

export async function getStatus(slug: string): Promise<StatusResponse> {
  const res = await fetch(`https://api.openstatus.dev/public/status/${slug}`, {
    cache: "no-cache",
  });

  if (res.ok) {
    const data = (await res.json()) as StatusResponse;
    return data;
  }

  return { status: "unknown" };
}

export async function GET(req: Request) {
  const [interRegularData, interLightData, calSemiBoldData, interMediumData] =
    await Promise.all([interRegular, interLight, calSemiBold, interMedium]);
  //  use the domain instead of the slug
  const { status } = await getStatus("openstatus");

  //  check for the mode dark or light and return the coresponding one
  const { label, color } = statusDictionary[status];

  return new ImageResponse(
    (
      <div tw="inline-flex max-w-fit items-center gap-2 rounded-md border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100 hover:text-black dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900 dark:hover:text-white">
        {label}
        <span className="relative flex h-2 w-2">
          {status === "operational" ? (
            <span
              tw={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-75 duration-1000`}
            />
          ) : null}
          <span tw={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
        </span>
      </div>
    ),
    {
      width: 118,
      height: 30,
      fonts: [
        {
          name: "Inter",
          data: interMediumData,
          style: "normal",
          weight: 500,
        },
        {
          name: "Inter",
          data: interRegularData,
          style: "normal",
          weight: 400,
        },
        {
          name: "Inter",
          data: interLightData,
          style: "normal",
          weight: 300,
        },
        {
          name: "Cal",
          data: calSemiBoldData,
          style: "normal",
          weight: 600,
        },
      ],
    },
  );
}
