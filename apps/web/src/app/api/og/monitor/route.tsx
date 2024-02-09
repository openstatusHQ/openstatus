import { ImageResponse } from "next/og";

import { DESCRIPTION, TITLE } from "@/app/shared-metadata";
import { getMonitorListData } from "@/lib/tb";
import { convertTimezoneToGMT } from "@/lib/timezone";
import { BasicLayout } from "../_components/basic-layout";
import { Tracker } from "../_components/tracker";
import { calSemiBold, interLight, interRegular, SIZE } from "../utils";

export const runtime = "edge";

export async function GET(req: Request) {
  const interRegularData = await interRegular;
  const interLightData = await interLight;
  const calSemiBoldData = await calSemiBold;

  const { searchParams } = new URL(req.url);

  const title =
    (searchParams.has("title") && searchParams.get("title")) || TITLE;

  const description =
    (searchParams.has("description") && searchParams.get("description")) ||
    DESCRIPTION;

  const monitorId =
    (searchParams.has("id") && searchParams.get("id")) || undefined;

  const timezone = convertTimezoneToGMT();

  const data =
    (monitorId &&
      (await getMonitorListData({
        monitorId,
        timezone,
      }))) ||
    [];

  return new ImageResponse(
    (
      <BasicLayout
        title={title}
        description={description}
        tw={data.length === 0 ? "mt-32" : undefined}
      >
        {Boolean(data.length) ? <Tracker data={data} /> : null}
      </BasicLayout>
    ),
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
