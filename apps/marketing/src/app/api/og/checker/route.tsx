import { ImageResponse } from "next/og";

import {
  getCheckerDataById,
  regionFormatter,
  timestampFormatter,
} from "@/components/ping-response-analysis/utils";
import { cn } from "@/lib/utils";
import { BasicLayout } from "../_components/basic-layout";
import {
  SIZE,
  calSemiBold,
  interLight,
  interMedium,
  interRegular,
} from "../utils";

export const runtime = "edge";

export async function GET(req: Request) {
  const [interRegularData, interLightData, calSemiBoldData, interMediumData] =
    await Promise.all([interRegular, interLight, calSemiBold, interMedium]);

  const { searchParams } = new URL(req.url);

  const id = searchParams.has("id") ? searchParams.get("id") : undefined;

  const data = id ? await getCheckerDataById(id) : undefined;

  function getMinMax() {
    if (!data?.checks?.length) return;
    let min = data.checks[0];
    let max = data.checks[0];
    for (const check of data.checks) {
      if (check.latency < min.latency) min = check;
      if (check.latency > max.latency) max = check;
    }
    return { min, max };
  }

  const { min, max } = getMinMax() || {};

  function getStatusColor(statusCode: number) {
    const green = String(statusCode).startsWith("2");
    if (green) return "border-green-300 bg-green-50 text-green-700";
    const blue = String(statusCode).startsWith("3");
    if (blue) return "border-blue-300 bg-blue-50 text-blue-700";
    const red =
      String(statusCode).startsWith("4") || String(statusCode).startsWith("5");
    if (red) return "border-rose-300 bg-rose-50 text-rose-700";
    return "border-gray-300 bg-gray-50 text-gray-700";
  }

  return new ImageResponse(
    <BasicLayout
      title="Speed Checker"
      description="Experience the performance of your application from around the different continents."
      tw="pt-4 pb-8"
    >
      <h2
        style={{
          width: (SIZE.width * 3) / 4,
          lineClamp: 2,
          textOverflow: "ellipsis",
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
        tw="text-3xl text-left font-medium mb-0"
      >
        {data?.url}
      </h2>
      {data && (
        <p tw="text-slate-500 text-right">
          {timestampFormatter(data.timestamp)}
        </p>
      )}
      <div tw="flex">
        <div tw="flex flex-col flex-1">
          <p tw="text-slate-600 mb-1">Min. Request</p>
        </div>
        <div tw="flex flex-col flex-1">
          <p tw="text-slate-600 mb-1">Max. Request</p>
        </div>
      </div>
      <div tw="flex w-full h-px bg-slate-200" />
      <div tw="flex">
        <div tw="flex flex-col flex-1">
          <div tw="flex items-center">
            <p tw="text-slate-600 font-medium text-lg mr-2 w-24 mb-2">Status</p>
            {min?.status && (
              <p
                tw={cn(
                  "text-lg border rounded-full px-3 mb-2",
                  getStatusColor(min.status),
                )}
              >
                {min?.status}
              </p>
            )}
          </div>
          <div tw="flex items-center">
            <p tw="text-slate-600 font-medium text-lg mr-2 w-24 mb-2">Region</p>
            {min?.region && (
              <p tw="text-black text-xl mb-2">{regionFormatter(min.region)}</p>
            )}
          </div>
          <div tw="flex items-center">
            <p tw="text-slate-600 font-medium text-lg mr-2 w-24 mb-2">
              Latency
            </p>
            <p tw="text-black text-xl font-mono mb-2">{min?.latency}ms</p>
          </div>
        </div>
        <div tw="flex flex-col flex-1">
          <div tw="flex items-center">
            <p tw="text-slate-600 font-medium text-lg mr-2 w-24 mb-2">Status</p>
            {max?.status && (
              <p
                tw={cn(
                  "text-lg border rounded-full px-3 mb-2",
                  getStatusColor(max.status),
                )}
              >
                {max?.status}
              </p>
            )}
          </div>
          <div tw="flex items-center">
            <p tw="text-slate-600 font-medium text-lg mr-2 w-24 mb-2">Region</p>
            {max?.region && (
              <p tw="text-black text-xl mb-2">{regionFormatter(max.region)}</p>
            )}
          </div>
          <div tw="flex items-center">
            <p tw="text-slate-600 font-medium text-lg mr-2 w-24 mb-2">
              Latency
            </p>
            <p tw="text-black text-xl font-mono mb-2">{max?.latency}ms</p>
          </div>
        </div>
      </div>
    </BasicLayout>,
    {
      ...SIZE,
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
