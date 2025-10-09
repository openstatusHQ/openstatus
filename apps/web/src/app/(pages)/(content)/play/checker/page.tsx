import type { Metadata } from "next";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { BottomCTA } from "@/components/marketing/in-between-cta";
import { getCheckerDataById } from "@/components/ping-response-analysis/utils";
import { redirect } from "next/navigation";
import CheckerPlay from "./_components/checker-play";
import { GlobalMonitoring } from "./_components/global-monitoring";
import { Informations } from "./_components/informations";
import { Testimonial } from "./_components/testimonial";
import { mockCheckAllRegions } from "./api/mock";
import { searchParamsCache } from "./search-params";

const TITLE = "Global Speed Checker";
const DESCRIPTION =
  "API speed test and website speed checker: global latency speed test from different locations.";

const OG_DESCRIPTION =
  "Test the performance of your api and website from different locations.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
  twitter: {
    ...twitterMetadata,
    title: TITLE,
    description: DESCRIPTION,
    images: [`/api/og?title=${TITLE}&description=${OG_DESCRIPTION}`],
  },
  openGraph: {
    ...ogMetadata,
    title: TITLE,
    description: DESCRIPTION,
    images: [`/api/og?title=${TITLE}&description=${OG_DESCRIPTION}`],
  },
};

export default async function PlayPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const { id } = searchParamsCache.parse(searchParams);

  const data = id
    ? process.env.NODE_ENV === "development"
      ? await mockCheckAllRegions()
      : await getCheckerDataById(id)
    : null;

  if (id && !data) return redirect("/play/checker");

  return (
    <div className="grid w-full gap-12">
      <CheckerPlay data={data} />
      <Testimonial />
      <GlobalMonitoring />
      <Informations />
      <BottomCTA className="mx-auto max-w-2xl lg:max-w-4xl" />
    </div>
  );
}
