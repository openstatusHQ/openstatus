import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import * as z from "zod";

import { monitorFlyRegionSchema } from "@openstatus/db/src/schema";
import { Separator } from "@openstatus/ui";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";
import { CopyLinkButton } from "./_components/copy-link-button";
import { MultiRegionTabs } from "./_components/multi-region-tabs";
import { RegionInfo } from "./_components/region-info";
import { ResponseDetailTabs } from "./_components/response-detail-tabs";
import { SelectRegion } from "./_components/select-region";
import { getCheckerDataById, timestampFormatter } from "./utils";

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

  const { region, headers, timing } = check;

  return (
    <>
      <BackButton href="/play/checker" />
      <Shell className="flex flex-col gap-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="font-semibold text-3xl">
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
        <div className="flex flex-col gap-8">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <SelectRegion defaultValue={region} />
            </div>
            <div>
              <RegionInfo check={check} />
            </div>
          </div>
          <ResponseDetailTabs timing={timing} headers={headers} />
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
