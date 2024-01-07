/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/server";

import { DESCRIPTION, TITLE } from "@/app/shared-metadata";

export const runtime = "edge";

const DEFAULT_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

const size = {
  width: 1200,
  height: 630,
};

const interRegular = fetch(
  new URL("../../../../public/fonts/Inter-Regular.ttf", import.meta.url),
).then((res) => res.arrayBuffer());

const interLight = fetch(
  new URL("../../../../public/fonts/Inter-Light.ttf", import.meta.url),
).then((res) => res.arrayBuffer());

const calSemiBold = fetch(
  new URL("../../../../public/fonts/CalSans-SemiBold.ttf", import.meta.url),
).then((res) => res.arrayBuffer());

// TODO: add publishedAt date
// Think of instead having the image, preferably display author...

export async function GET(req: Request) {
  const interRegularData = await interRegular;
  const interLightData = await interLight;
  const calSemiBoldData = await calSemiBold;

  const { searchParams } = new URL(req.url);

  const title = searchParams.has("title") ? searchParams.get("title") : TITLE;
  const description = searchParams.has("description")
    ? searchParams.get("description")
    : DESCRIPTION;
  const image = searchParams.has("image")
    ? searchParams.get("image")
    : undefined;

  return new ImageResponse(
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
            "radial-gradient(farthest-corner at 100px 100px, #cbd5e1, white 80%)", // tbd: switch color position
        }}
      ></div>
      <div tw="flex flex-col h-full justify-between px-24">
        <div tw="flex flex-col flex-1 justify-end">
          <div tw="flex flex-col px-12">
            {/* lineClamp not working... */}
            <h1 style={{ fontFamily: "Cal", lineClamp: "2" }} tw="text-6xl">
              {title}
            </h1>
            <p style={{ lineClamp: "2" }} tw="text-slate-600 text-3xl">
              {description}
            </p>
          </div>
        </div>
        {image ? (
          <div tw="flex justify-center shadow-2xl mt-1">
            <img
              alt=""
              style={{ objectFit: "cover", height: 350 }} // h-80 = 320px
              tw="flex w-full border-2 rounded-xl"
              src={new URL(image, DEFAULT_URL).toString()}
            />
          </div>
        ) : null}
      </div>
    </div>,
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
