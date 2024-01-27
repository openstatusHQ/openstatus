/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/server";

import { DESCRIPTION, TITLE } from "@/app/shared-metadata";
import { Background } from "./_components/background";
import {
  calSemiBold,
  DEFAULT_URL,
  interLight,
  interMedium,
  interRegular,
  SIZE,
} from "./utils";

export const runtime = "edge";

// const TITLE = "A better way to monitor your services.";
// const DESCRIPTION = "Reduce alert fatigue by triggering only relevant alerts when your services experience downtime.";
const IMAGE = "assets/og/dashboard.png";
const FOOTER = "openstatus.dev";

export async function GET(req: Request) {
  const interMediumData = await interMedium;
  const interRegularData = await interRegular;
  const interLightData = await interLight;
  const calSemiBoldData = await calSemiBold;

  const { searchParams } = new URL(req.url);

  const title =
    (searchParams.has("title") && searchParams.get("title")) || TITLE;

  const description =
    (searchParams.has("description") && searchParams.get("description")) ||
    DESCRIPTION;

  const image =
    (searchParams.has("image") && searchParams.get("image")) || IMAGE;

  return new ImageResponse(
    (
      <Background tw="justify-start items-start">
        <div
          style={{
            clipPath: "polygon(90% 0%, 200% 0%, 200% 200%, -30% 200%)",
            zIndex: -1,
          }}
          tw="flex absolute h-full w-full bg-slate-200"
        >
          <img
            alt=""
            style={{ objectFit: "cover" }}
            tw="flex w-full"
            src={new URL(image, DEFAULT_URL).toString()}
          />
        </div>
        <div tw="flex flex-col justify-between h-full flex-1 py-24 px-24">
          <div tw="flex flex-col h-full flex-1 justify-center">
            <h1
              style={{ fontFamily: "Cal", width: 700 }}
              tw="text-6xl text-black"
            >
              {title}
            </h1>
            <p style={{ width: 580 }} tw="text-4xl text-slate-700">
              {description}
            </p>
          </div>
          <div tw="flex w-full">
            <p tw="font-medium text-xl">{FOOTER}</p>
          </div>
        </div>
      </Background>
    ),
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
