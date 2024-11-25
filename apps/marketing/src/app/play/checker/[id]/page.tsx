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
import { MultiRegionTabs } from "@/components/speed-checker/multi-region-tabs";
import {
  getCheckerDataById,
  timestampFormatter,
} from "@/components/speed-checker/utils";
import { Shell } from "@openstatus/ui";
import { searchParamsCache } from "./search-params";
import {
  CopyToClipboardButton,
  getCurrentLink,
} from "@/components/speed-checker/copy-to-clipboard-button";

interface Props {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function CheckPage({ params, searchParams }: Props) {
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
          <CopyToClipboardButton copyValue={getCurrentLink} copyIcon="link" />
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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
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
