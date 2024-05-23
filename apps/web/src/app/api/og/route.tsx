/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";

import { DESCRIPTION, TITLE } from "@/app/shared-metadata";
import { Background } from "./_components/background";
import {
  DEFAULT_URL,
  SIZE,
  calSemiBold,
  interLight,
  interMedium,
  interRegular,
} from "./utils";

export const runtime = "edge";

// const TITLE = "A better way to monitor your services.";
// const DESCRIPTION = "Reduce alert fatigue by triggering only relevant alerts when your services experience downtime.";
const IMAGE = "assets/og/dashboard.png";
const FOOTER = "openstatus.dev";

export async function GET(req: Request) {
  const [interRegularData, interLightData, calSemiBoldData, interMediumData] =
    await Promise.all([interRegular, interLight, calSemiBold, interMedium]);

  const { searchParams } = new URL(req.url);

  const title =
    (searchParams.has("title") && searchParams.get("title")) || TITLE;

  const description =
    (searchParams.has("description") && searchParams.get("description")) ||
    DESCRIPTION;

  const image =
    (searchParams.has("image") && searchParams.get("image")) || IMAGE;

  const footer =
    (searchParams.has("footer") && searchParams.get("footer")) || FOOTER;

  return new ImageResponse(
    <Background tw="justify-start items-start">
      <div
        style={{ clipPath: "polygon(90% 0%, 200% 0%, 200% 200%, -30% 200%)" }}
        tw="flex absolute h-full w-full bg-slate-200"
      >
        <img
          alt=""
          style={{ objectFit: "cover" }}
          tw="flex w-full h-full"
          src={new URL(image, DEFAULT_URL).toString()}
        />
      </div>
      {/* adds a border to the mask element */}
      <div
        style={{
          clipPath: "polygon(90% 0%, 170% 0%, -30% 200%, -29% 200%)",
          // from-slate-100 to-slate-300
          backgroundImage: "linear-gradient(to bottom left, #f1f5f9, #cbd5e1)",
        }}
        tw="flex absolute h-full w-full" // bg-slate-200
      />
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
          <p style={{ width: 450 }} tw="font-medium text-xl">
            {footer}
          </p>
        </div>
      </div>
    </Background>,
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
