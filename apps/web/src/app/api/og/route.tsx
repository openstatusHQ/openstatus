/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";

import { OG_DESCRIPTION, TITLE } from "@/app/shared-metadata";
import {
  SIZE,
  calSemiBold,
  interLight,
  interMedium,
  interRegular,
  commitMonoRegular,
  commitMonoBold,
} from "./utils";

export const runtime = "edge";

const FOOTER = "openstatus.dev";
const CATEGORY = "product";

export async function GET(req: Request) {
  const [
    interRegularData,
    interLightData,
    calSemiBoldData,
    interMediumData,
    commitMonoRegularData,
    commitMonoBoldData,
  ] = await Promise.all([
    interRegular,
    interLight,
    calSemiBold,
    interMedium,
    commitMonoRegular,
    commitMonoBold,
  ]);

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
    (
      <div tw="relative flex flex-col items-start justify-start w-full h-full bg-gray-100">
        <div
          tw="flex flex-col h-full p-8 w-full"
          style={{ fontFamily: "Commit Mono" }}
        >
          <div tw="flex flex-col justify-end flex-1 mb-8">
            <p tw="text-xl text-left">[{category.toLowerCase()}]</p>
            <h1 tw="text-6xl text-black line-clamp-2 text-left">{title}</h1>
            <p tw="text-4xl text-slate-700 line-clamp-2 text-left">
              {description}
            </p>
          </div>
          <p tw="font-medium text-xl text-slate-500 text-left">{footer}</p>
        </div>
      </div>
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
        {
          name: "Commit Mono",
          data: commitMonoRegularData,
          style: "normal",
          weight: 400,
        },
        {
          name: "Commit Mono",
          data: commitMonoBoldData,
          style: "normal",
          weight: 700,
        },
      ],
    }
  );
}
