import { ImageResponse } from "next/server";

import { getMonitorListData } from "@/lib/tb";
import { cn, formatDate } from "@/lib/utils";

export const runtime = "edge";

const size = {
  width: 1200,
  height: 630,
};

const TITLE = "Open Status";
const DESCRIPTION = "An Open Source Alternative for your next Status Page";
const SITE_ID = "openstatus";
const LIMIT = 30;

const interRegular = fetch(
  new URL("../../../public/fonts/Inter-Regular.ttf", import.meta.url),
).then((res) => res.arrayBuffer());

const calSemiBold = fetch(
  new URL("../../../public/fonts/CalSans-SemiBold.ttf", import.meta.url),
).then((res) => res.arrayBuffer());

export async function GET(req: Request) {
  const interRegularData = await interRegular;
  const calSemiBoldData = await calSemiBold;

  const { searchParams } = new URL(req.url);

  const title = searchParams.has("title") ? searchParams.get("title") : TITLE;
  const description = searchParams.has("description")
    ? searchParams.get("description")
    : DESCRIPTION;
  const siteId = searchParams.has("siteId")
    ? searchParams.get("siteId")
    : SITE_ID;

  const data = siteId
    ? await getMonitorListData({ siteId, groupBy: "day", limit: LIMIT })
    : [];

  return new ImageResponse(
    (
      <div tw="relative flex flex-col bg-white items-center justify-center w-full h-full">
        <div
          tw="flex w-full h-full absolute inset-0"
          // not every css variable is supported
          style={{
            backgroundImage: "radial-gradient(#cbd5e1 10%, transparent 10%)",
            backgroundSize: "24px 24px",
          }}
        ></div>
        <div
          tw="flex w-full h-full absolute inset-0 opacity-70"
          style={{
            backgroundColor: "white",
            backgroundImage:
              "radial-gradient(farthest-corner at 100px 100px, #64748b, white 70%)", // tbd: switch color position
          }}
        ></div>
        <div tw="max-w-4xl relative flex flex-col">
          <h1 style={{ fontFamily: "Cal" }} tw="text-6xl">
            {title}
          </h1>
          <p tw="text-slate-600 text-3xl">{description}</p>
          {data && data.length > 0 ? (
            <div tw="flex flex-col w-full mt-6">
              <div tw="flex flex-row relative">
                {/* Empty State */}
                {new Array(LIMIT).fill(null).map((_, i) => {
                  return (
                    <div
                      key={i}
                      tw="h-16 w-2.5 rounded-full mr-1 bg-black/20"
                    ></div>
                  );
                })}
                <div tw="flex flex-row absolute right-0">
                  {data.map((item, i) => {
                    const status = item.ok / item.count === 1 ? "up" : "down"; // needs to be better defined!
                    return (
                      <div
                        key={i}
                        tw={cn("h-16 w-2.5 rounded-full mr-1", {
                          "bg-green-600": status === "up",
                          "bg-red-600": status === "down",
                        })}
                      ></div>
                    );
                  })}
                </div>
              </div>
              <p tw="text-slate-500 text-lg">{formatDate(new Date())}</p>
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Inter",
          data: interRegularData,
          style: "normal",
          weight: 400,
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
