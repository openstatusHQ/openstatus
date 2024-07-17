import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import * as z from "zod";

import { monitorFlyRegionSchema } from "@openstatus/db/src/schema/shared";
import { Separator } from "@openstatus/ui";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";
import { CopyLinkButton } from "@/components/ping-response-analysis/copy-link-button";
import { MultiRegionTabs } from "@/components/ping-response-analysis/multi-region-tabs";
import { RegionInfo } from "@/components/ping-response-analysis/region-info";
import { ResponseDetailTabs } from "@/components/ping-response-analysis/response-detail-tabs";
import { SelectRegion } from "@/components/ping-response-analysis/select-region";
import {
  getCheckerDataById,
  timestampFormatter,
} from "@/components/ping-response-analysis/utils";

/**
 * allowed URL search params
 */
const searchParamsSchema = z.object({
  region: monitorFlyRegionSchema.optional(),
});

interface Props {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function CheckPage({ params, searchParams }: Props) {
  const search = searchParamsSchema.safeParse(searchParams);

  const selectedRegion = search.success ? search.data.region : undefined;

  const data = await getCheckerDataById(params.id);

  if (!data) redirect("/play/checker");

  const check =
    data.checks.find((i) => i.region === selectedRegion) || data.checks?.[0];

  const { region, headers, timing, status } = check;

  return (
    <Shell className="my-8 flex flex-col gap-8 md:my-16">
      <div className="flex justify-between gap-4">
        <div className="flex max-w-[calc(100%-50px)] flex-col gap-1">
          <h1 className="truncate text-wrap font-semibold text-lg md:text-3xl sm:text-xl">
            {data.url}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {timestampFormatter(data.time)}
          </p>
        </div>
        <div>
          <CopyLinkButton />
        </div>
      </div>
      <MultiRegionTabs regions={data.checks} />
      <Separator />
      <div className="flex flex-col gap-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <SelectRegion defaultValue={region} />
          </div>
          <div>
            <RegionInfo check={check} />
          </div>
        </div>
        <ResponseDetailTabs {...{ timing, headers, status }} hideInfo={false} />
      </div>
      <Separator />
      <p className="text-muted-foreground text-sm">
        The data will be stored for{" "}
        <span className="text-foreground">1 day</span>. If you want to persist
        the data,{" "}
        <Link
          href="/app/login"
          className="text-foreground underline underline-offset-4 hover:no-underline"
        >
          login
        </Link>{" "}
        to your account.
      </p>
    </Shell>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const title = "Speed Checker";
  const description =
    "Get speed insights for your api, website from multiple regions.";
  return {
    ...defaultMetadata,
    title,
    description,
    twitter: {
      ...twitterMetadata,
      title,
      description,
      images: [`/api/og/checker?id=${params?.id}`],
    },
    openGraph: {
      ...ogMetadata,
      title,
      description,
      images: [`/api/og/checker?id=${params?.id}`],
    },
  };
}
