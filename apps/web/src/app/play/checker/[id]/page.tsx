import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { flyRegions } from "@openstatus/db/src/schema/constants";
import { Separator } from "@openstatus/ui";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Shell } from "@/components/dashboard/shell";
import { CopyLinkButton } from "@/components/ping-response-analysis/copy-link-button";
import { MultiRegionTabs } from "@/components/ping-response-analysis/multi-region-tabs";
import {
  getCheckerDataById,
  timestampFormatter,
} from "@/components/ping-response-analysis/utils";
import { searchParamsCache } from "./search-params";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CheckPage(props: Props) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const { regions } = searchParamsCache.parse(searchParams);
  const selectedRegions = regions || [...flyRegions];

  const data = await getCheckerDataById(params.id);

  if (!data) redirect("/play/checker");

  return (
    <Shell className="flex flex-col gap-8">
      <div className="flex justify-between gap-4">
        <div className="flex max-w-[calc(100%-50px)] flex-col gap-1">
          <h1 className="truncate text-wrap font-semibold text-lg sm:text-xl md:text-3xl">
            {data.url}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            {timestampFormatter(data.timestamp)}
          </p>
        </div>
        <div>
          <CopyLinkButton />
        </div>
      </div>
      <MultiRegionTabs
        regions={data.checks}
        selectedRegions={selectedRegions}
      />
      <Separator />
      <p className="text-muted-foreground text-sm">
        The data will be stored for{" "}
        <span className="text-foreground">7 days</span>. If you want to persist
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

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const title = "Global Speed Checker";
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
