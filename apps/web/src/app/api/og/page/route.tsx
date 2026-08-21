import { pageConfigurationSchema } from "@openstatus/db/src/schema";
import { Tracker } from "@openstatus/tracker";
import { ImageResponse } from "next/og";

import { DESCRIPTION, TITLE } from "../../../../lib/metadata/shared-metadata";
import { api } from "../../../../trpc/server";
import { BasicLayout } from "../_components/basic-layout";
import { StatusCheck } from "../_components/status-check";
import { StatusHero } from "../_components/status-hero";
import { StatusMinimal } from "../_components/status-minimal";
import {
  SIZE,
  calSemiBold,
  commitMonoBold,
  commitMonoRegular,
  interLight,
  interMedium,
  interRegular,
} from "../utils";
import { aggregatePageDays, aggregateUptime, stateContext } from "./aggregate";

export const runtime = "edge";

const CACHE_CONTROL =
  "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const slug = searchParams.get("slug") ?? "";

  const page = await api.statusPage.getLight.query({ slug });
  const _protected = page?.accessType !== "public";
  const title = page ? page.title : TITLE;

  // REMINDER: if password protected, we keep the status 'operational' by default, hiding the actual status
  const tracker = new Tracker({
    incidents: _protected ? undefined : page?.incidents,
    statusReports: _protected ? undefined : page?.statusReports,
    maintenances: _protected ? undefined : page?.maintenances,
  });

  // protected (and unknown) pages keep the legacy neutral image — the
  // data-rich hero is for public pages only
  if (_protected) {
    const [interRegularData, interLightData, calSemiBoldData] =
      await Promise.all([interRegular, interLight, calSemiBold]);

    return new ImageResponse(
      <BasicLayout
        title={title}
        description={page ? "" : DESCRIPTION}
        tw="py-24 px-24"
      >
        <StatusCheck tracker={tracker} />
      </BasicLayout>,
      {
        ...SIZE,
        headers: { "cache-control": CACHE_CONTROL },
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

  const [regular, medium, cal, mono, monoBold] = await Promise.all([
    interRegular,
    interMedium,
    calSemiBold,
    commitMonoRegular,
    commitMonoBold,
  ]);

  const fonts = [
    {
      name: "Inter",
      data: regular,
      style: "normal" as const,
      weight: 400 as const,
    },
    {
      name: "Inter",
      data: medium,
      style: "normal" as const,
      weight: 500 as const,
    },
    { name: "Cal", data: cal, style: "normal" as const, weight: 600 as const },
    {
      name: "CommitMono",
      data: mono,
      style: "normal" as const,
      weight: 400 as const,
    },
    {
      name: "CommitMono",
      data: monoBold,
      style: "normal" as const,
      weight: 700 as const,
    },
  ];

  const cfgResult = pageConfigurationSchema.safeParse(
    page?.configuration ?? {},
  );
  const cfg = cfgResult.success
    ? cfgResult.data
    : pageConfigurationSchema.parse({});

  const componentIds = page
    ? page.pageComponents
        .filter((component) => component.type === "monitor")
        .map((component) => String(component.id))
    : [];

  // bars are decorative on the preview — a failing uptime read must not break it
  const components = componentIds.length
    ? await api.statusPage.getUptime
        .query({
          slug,
          pageComponentIds: componentIds,
          cardType: cfg.value,
          barType: cfg.type,
        })
        .catch(() => null)
    : null;

  const days = aggregatePageDays(components ?? []);
  const uptime = cfg.uptime ? aggregateUptime(components ?? []) : null;
  const details = tracker.currentDetails;

  // operational pages without any bar data get the neutral minimal treatment;
  // active events always take their state layout even without data
  const noData = !days.some((day) => day.status !== "empty");
  if (details.variant === "up" && noData) {
    const domain =
      page?.customDomain || (page ? `${page.slug}.openstatus.dev` : "");
    return new ImageResponse(<StatusMinimal title={title} domain={domain} />, {
      ...SIZE,
      headers: { "cache-control": CACHE_CONTROL },
      fonts,
    });
  }

  const subline =
    stateContext(details.variant, {
      statusReports: page?.statusReports,
      maintenances: page?.maintenances,
      incidents: page?.incidents,
    }) ?? (uptime ? `${uptime} uptime · last ${days.length} days` : null);

  return new ImageResponse(
    <StatusHero
      title={title}
      icon={page?.icon ?? null}
      variant={details.variant}
      statusLong={details.long}
      subline={subline}
      lookbackDays={days.length || cfg.days}
      days={days}
    />,
    { ...SIZE, headers: { "cache-control": CACHE_CONTROL }, fonts },
  );
}
