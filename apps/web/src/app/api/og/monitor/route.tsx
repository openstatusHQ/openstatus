import { ImageResponse } from "next/og";

import { OSTinybird } from "@openstatus/tinybird";

import { DESCRIPTION, TITLE } from "@/app/shared-metadata";
import { env } from "@/env";
import { BasicLayout } from "../_components/basic-layout";
import { Tracker } from "../_components/tracker";
import { SIZE, calSemiBold, interLight, interRegular } from "../utils";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

export const runtime = "edge";

export async function GET(req: Request) {
  const [interRegularData, interLightData, calSemiBoldData] = await Promise.all(
    [interRegular, interLight, calSemiBold],
  );

  const { searchParams } = new URL(req.url);

  const title =
    (searchParams.has("title") && searchParams.get("title")) || TITLE;

  const description =
    (searchParams.has("description") && searchParams.get("description")) ||
    DESCRIPTION;

  const monitorId =
    (searchParams.has("id") && searchParams.get("id")) || undefined;

  const data =
    (monitorId &&
      (await tb.endpointStatusPeriod("45d")({
        monitorId,
      }))) ||
    [];

  return new ImageResponse(
    <BasicLayout
      title={title}
      description={description}
      tw={data.length === 0 ? "mt-32" : undefined}
    >
      {data.length ? <Tracker data={data} /> : null}
    </BasicLayout>,
    {
      ...SIZE,
      fonts: [
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
