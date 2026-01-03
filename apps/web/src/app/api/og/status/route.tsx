import { ImageResponse } from "next/og";

import { DESCRIPTION, TITLE } from "@/app/shared-metadata";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/server";
import type { RouterOutputs } from "@openstatus/api";
import { format } from "date-fns";
import { SIZE } from "../utils";

export const runtime = "edge";

const FOOTER = "openstatus.dev";

type Page = NonNullable<RouterOutputs["statusPage"]["get"]>;

function getContent(page?: Page | null) {
  switch (page?.status) {
    case "error":
      return {
        label: "Incident Ongoing",
        bg: "bg-rose-500/90 border-rose-500",
        text: "text-rose-500",
      };
    case "degraded":
      return {
        label: "Degraded Performance",
        bg: "bg-orange-500/90 border-orange-500",
        text: "text-amber-500",
      };
    case "info":
      return {
        label: "Maintenance",
        bg: "bg-blue-500/90 border-blue-500",
        text: "text-blue-500",
      };
    case "success":
      return {
        label: "All Systems Operational",
        bg: "bg-green-500/90 border-green-500",
        text: "text-green-500",
      };
    default:
      return {
        label: "Unknown",
        bg: "bg-gray-500/90 border-gray-500",
        text: "text-gray-500",
      };
  }
}

export async function GET(req: Request) {
  const fontMonoRegular = await fetch(
    new URL("../../../../public/fonts/RobotoMono-Regular.ttf", import.meta.url),
  ).then((res) => res.arrayBuffer());
  const fontMonoMedium = await fetch(
    new URL("../../../../public/fonts/RobotoMono-Medium.ttf", import.meta.url),
  ).then((res) => res.arrayBuffer());
  const fontMonoBold = await fetch(
    new URL("../../../../public/fonts/RobotoMono-Bold.ttf", import.meta.url),
  ).then((res) => res.arrayBuffer());

  const { searchParams } = new URL(req.url);

  const slug = searchParams.has("slug") ? searchParams.get("slug") : undefined;

  const page = await api.statusPage.get.query({ slug: slug || "" });
  const content = getContent(page);

  const title = page ? page.title : TITLE;
  const description = page ? page.description : DESCRIPTION;
  const category = content?.label || "unknown";
  const footer =
    page?.customDomain || page ? `${page?.slug}.openstatus.dev` : FOOTER;

  return new ImageResponse(
    <div tw="relative flex flex-col items-start justify-start w-full h-full bg-gray-100">
      <div
        tw="flex flex-col h-full p-8 w-full"
        style={{ fontFamily: "Font Mono" }}
      >
        <div tw="flex flex-col justify-end flex-1 mb-8">
          <div tw={cn("flex flex-row items-center text-2xl", content?.text)}>
            [<div tw={cn("rounded-full h-5 w-5 mr-2", content?.bg)} />
            <p>{category}</p>] | {format(new Date(), "MMM d, yyyy HH:mm zzz")}
          </div>
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
