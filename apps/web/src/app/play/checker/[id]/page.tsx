import Link from "next/link";
import { redirect } from "next/navigation";
import * as z from "zod";

import { monitorFlyRegionSchema } from "@openstatus/db/src/schema";
import { Separator } from "@openstatus/ui";

import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";
import { HighlightCard } from "./_components/highlight-card";
import { MultiRegionChart } from "./_components/multi-region-chart";
import { MultiRegionTable } from "./_components/multi-region-table";
import { MultiRegionTabs } from "./_components/multi-region-tabs";
import { ResponseHeaderTable } from "./_components/response-header-table";
import { ResponseTimingTable } from "./_components/response-timing-table";
import { SelectRegion } from "./_components/select-region";
import { getCheckerDataById, regionFormatter, valueFormatter } from "./utils";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  region: monitorFlyRegionSchema.optional(),
});

export default async function CheckPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);

  const selectedRegion = search.success ? search.data.region : undefined;

  const data = await getCheckerDataById(params.id);

  if (!data) redirect("/play/check");

  const check =
    data.checks.find((i) => i.region === selectedRegion) || data.checks?.[0];

  const { status, region, headers, latency, timing } = check;

  return (
    <>
      <BackButton href="/play/checker" />
      <Shell className="grid gap-8">
        <div className="grid gap-3">
          <h1 className="text-2xl font-semibold">{data.url}</h1>
          <p className="text-muted-foreground">
            {new Date(data.time).toLocaleString()}
          </p>
        </div>
        <MultiRegionTabs regions={data.checks} />
        <Separator />
        <div className="grid gap-8">
          <SelectRegion defaultValue={region} />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <HighlightCard
              title="Region"
              value={regionFormatter(region)}
              icon="globe"
            />
            <HighlightCard title="Status" value={status} icon="activity" />
            <HighlightCard
              title="Latency"
              value={valueFormatter(latency)}
              icon="timer"
            />
          </div>
          <ResponseTimingTable timing={timing} />
          <ResponseHeaderTable headers={headers} />
        </div>
        <Separator />
        <p className="text-muted-foreground text-sm">
          The data will be stored for <code>60min</code>. If you want to persist
          the data,{" "}
          <Link
            href="/app/sign-in"
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            login
          </Link>{" "}
          to your account.
        </p>
      </Shell>
    </>
  );
}
