import Link from "next/link";
import { redirect } from "next/navigation";
import * as z from "zod";

import { monitorFlyRegionSchema } from "@openstatus/db/src/schema";
import { Separator } from "@openstatus/ui";

import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";
import { CopyLinkButton } from "./_components/copy-link-button";
import { MultiRegionTabs } from "./_components/multi-region-tabs";
import { RegionInfo } from "./_components/region-info";
import { ResponseHeaderTable } from "./_components/response-header-table";
import { ResponseTimingTable } from "./_components/response-timing-table";
import { SelectRegion } from "./_components/select-region";
import { getCheckerDataById, timestampFormatter } from "./utils";

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

  if (!data) redirect("/play/checker");

  const check =
    data.checks.find((i) => i.region === selectedRegion) || data.checks?.[0];

  const { status, region, headers, latency, timing } = check;

  return (
    <>
      <BackButton href="/play" />
      <Shell className="grid gap-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold">
              <span className="truncate">{data.url}</span>
            </h1>
            <p className="text-muted-foreground">
              {timestampFormatter(data.time)}
            </p>
          </div>
          <div>
            <CopyLinkButton />
          </div>
        </div>
        <MultiRegionTabs regions={data.checks} />
        <Separator />
        <div className="grid gap-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <SelectRegion defaultValue={region} />
            </div>
            <div>
              <RegionInfo check={check} />
            </div>
          </div>
          <ResponseTimingTable timing={timing} />
          <ResponseHeaderTable headers={headers} />
        </div>
        <Separator />
        <p className="text-muted-foreground text-sm">
          The data will be stored for{" "}
          <span className="text-foreground">1 day</span>. If you want to persist
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
