/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";

import { DESCRIPTION, TITLE } from "@/app/shared-metadata";
import { BasicLayout } from "../_components/basic-layout";
import {
  DEFAULT_URL,
  SIZE,
  calSemiBold,
  interLight,
  interRegular,
} from "../utils";

export const runtime = "edge";

export async function GET(req: Request) {
  const [interRegularData, interLightData, calSemiBoldData] = await Promise.all(
    [interRegular, interLight, calSemiBold],
  );

  const { searchParams } = new URL(req.url);

  const title =
    (searchParams.has("title") && searchParams.get("title")) || TITLE;
  const description = searchParams.has("description")
    ? searchParams.get("description")
    : undefined;
  const image = searchParams.has("image")
    ? searchParams.get("image")
    : undefined;

  return new ImageResponse(
    <BasicLayout title={title} description={description}>
      {image ? (
        <img
          alt=""
          style={{ objectFit: "cover", height: 330 }} // h-80 = 320px
          tw="flex w-full"
          src={new URL(image, DEFAULT_URL).toString()}
        />
      ) : null}
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
