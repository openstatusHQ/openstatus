/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";

import { OG_DESCRIPTION, TITLE } from "@/lib/metadata/shared-metadata";
import { SIZE } from "./utils";

export const runtime = "edge";

const FOOTER = "openstatus.dev";
const CATEGORY = "product";

export async function GET(req: Request) {
  const fontMonoRegular = await fetch(
    new URL("../../../public/fonts/RobotoMono-Regular.ttf", import.meta.url),
  ).then((res) => res.arrayBuffer());
  const fontMonoMedium = await fetch(
    new URL("../../../public/fonts/RobotoMono-Medium.ttf", import.meta.url),
  ).then((res) => res.arrayBuffer());
  const fontMonoBold = await fetch(
    new URL("../../../public/fonts/RobotoMono-Bold.ttf", import.meta.url),
  ).then((res) => res.arrayBuffer());

  const { searchParams } = new URL(req.url);

  const title =
    (searchParams.has("title") && searchParams.get("title")) || TITLE;

  const description =
    (searchParams.has("description") && searchParams.get("description")) ||
    OG_DESCRIPTION;

  const footer =
    (searchParams.has("footer") && searchParams.get("footer")) || FOOTER;

  const category =
    (searchParams.has("category") && searchParams.get("category")) || CATEGORY;

  return new ImageResponse(
    <div tw="relative flex flex-col items-start justify-start w-full h-full bg-gray-100">
      <div
        tw="flex flex-col h-full p-8 w-full"
        style={{ fontFamily: "Font Mono" }}
      >
        <div tw="flex flex-col justify-end flex-1 mb-8">
          <p tw="text-xl text-left">[{category.toLowerCase()}]</p>
          <h1
            tw="text-6xl text-black text-left font-medium"
            style={{ lineClamp: 2, display: "block" }}
          >
            {title}
          </h1>
          <p
            tw="text-4xl text-slate-700 text-left"
            style={{ lineClamp: 2, display: "block" }}
          >
            {description}
          </p>
        </div>
        <p tw="font-medium text-xl text-slate-500 text-left">{footer}</p>
      </div>
    </div>,
    {
      ...SIZE,
      fonts: [
        {
          name: "Font Mono",
          data: fontMonoRegular,
          style: "normal",
          weight: 400,
        },
        {
          name: "Font Mono",
          data: fontMonoMedium,
          style: "normal",
          weight: 500,
        },
        {
          name: "Font Mono",
          data: fontMonoBold,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
