import { ImageResponse } from "next/og";

import { OSTinybird, safePipeData } from "@openstatus/tinybird";

import { isStale } from "@/app/(landing)/status/utils";
import { env } from "@/env";
import {
  cachedGetExternalServiceBySlug,
  cachedListExternalServices,
} from "@/lib/external-service-cache";
import { cn } from "@/lib/utils";
import { SIZE } from "../utils";

export const runtime = "edge";

const FOOTER = "openstatus.dev/status";
const INDEX_TITLE = "External Status";
const INDEX_DESCRIPTION =
  "Check if your external providers are working properly";

// Mirrors getPillStyle in (landing)/status/external-service-pill.tsx so the OG
// label matches the on-page pill.
function getStatus(args: { indicator: string; status: string }): {
  label: string;
  bg: string;
  text: string;
} {
  if (args.status === "under_maintenance") {
    return {
      label: "Maintenance",
      bg: "bg-blue-500/90 border-blue-500",
      text: "text-blue-500",
    };
  }
  switch (args.indicator) {
    case "none":
      return {
        label: "Operational",
        bg: "bg-green-500/90 border-green-500",
        text: "text-green-500",
      };
    case "minor":
      return {
        label: "Minor Issue",
        bg: "bg-amber-500/90 border-amber-500",
        text: "text-amber-500",
      };
    case "major":
      return {
        label: "Partial Outage",
        bg: "bg-orange-500/90 border-orange-500",
        text: "text-orange-500",
      };
    case "critical":
      return {
        label: "Major Outage",
        bg: "bg-rose-500/90 border-rose-500",
        text: "text-rose-500",
      };
    default:
      return {
        label: "Unknown",
        bg: "bg-gray-500/90 border-gray-500",
        text: "text-gray-500",
      };
  }
}

const UNKNOWN = {
  label: "Unknown",
  bg: "bg-gray-500/90 border-gray-500",
  text: "text-gray-500",
};

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
  const logoSvg = await fetch(
    new URL(
      "../../../../../public/assets/logos/OpenStatus-Logo.svg",
      import.meta.url,
    ),
  ).then((res) => res.text());
  const logoSrc = `data:image/svg+xml;base64,${btoa(logoSvg)}`;

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") || undefined;

  const service = slug ? await cachedGetExternalServiceBySlug(slug) : undefined;

  let category: string;
  let categoryDot: string | undefined;
  let title: string;
  let description: string;
  let footer: string;

  if (!service) {
    const services = await cachedListExternalServices();
    category = "external status";
    title = INDEX_TITLE;
    description = `${services.length} providers monitored — ${INDEX_DESCRIPTION}`;
    footer = FOOTER;
  } else {
    const aliasSlugs = Array.isArray(service.aliases) ? service.aliases : [];
    const slugChain = [service.slug, ...aliasSlugs];

    const tb = new OSTinybird(env.TINY_BIRD_API_KEY);
    const latestRes = await safePipeData(
      tb.externalStatusLatest({ ids: slugChain }),
      "externalStatusLatest (og)",
    );
    const latestRows = Array.isArray(latestRes.data) ? latestRes.data : [];
    latestRows.sort((a, b) => b.last_fetched_at - a.last_fetched_at);
    const latest = latestRows[0];

    const fetchedAt = latest?.last_fetched_at ?? 0;
    const stale = fetchedAt === 0 || isStale(fetchedAt);
    const content = stale
      ? UNKNOWN
      : getStatus({
          indicator: latest?.indicator ?? "",
          status: latest?.status ?? "",
        });

    category = content.label;
    categoryDot = content.bg;
    title = `Is ${service.name} down?`;
    description = "";
    footer = `${FOOTER}/${service.slug}`;
  }

  return new ImageResponse(
    <div tw="relative flex flex-col items-start justify-start w-full h-full bg-gray-100">
      <div
        tw="flex flex-col h-full p-8 w-full"
        style={{ fontFamily: "Font Mono" }}
      >
        <div tw="flex flex-col justify-end flex-1 mb-8">
          <div tw="flex flex-row items-center text-2xl text-slate-700">
            [
            {categoryDot ? (
              <div tw={cn("rounded-full h-5 w-5 mr-2", categoryDot)} />
            ) : null}
            <p>{category}</p>]
            {service
              ? ` | ${new Date().toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZoneName: "short",
                  timeZone: "UTC",
                })}`
              : ""}
          </div>
          <h1
            tw="text-6xl text-black text-left font-medium"
            style={{ lineClamp: 2, display: "block" }}
          >
            {title}
          </h1>
          {description ? (
            <p
              tw="text-4xl text-slate-700 text-left"
              style={{ lineClamp: 2, display: "block" }}
            >
              {description}
            </p>
          ) : null}
        </div>
        <div tw="flex flex-row items-center text-slate-500">
          <img
            src={logoSrc}
            width={24}
            height={24}
            alt="OpenStatus"
            style={{ marginRight: 8 }}
          />
          <p tw="font-medium text-xl text-left">{footer}</p>
        </div>
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
