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
import { Testimonial } from "./_components/testimonial";
import { searchParamsCache } from "./search-params";

const title = "Global Speed Checker";
const description =
  "Test the performance of your api, website from multiple regions. Get speed insights for free.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title,
  description,
  twitter: {
    ...twitterMetadata,
    title,
    description,
    images: [`/api/og?title=${title}&description=${description}`],
  },
  openGraph: {
    ...ogMetadata,
    title,
    description,
    images: [`/api/og?title=${title}&description=${description}`],
  },
};

export default async function PlayPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const { id } = searchParamsCache.parse(searchParams);

  const data = id ? await getCheckerDataById(id) : null;

  if (id && !data) return redirect("/play/checker");

  return (
    <div className="grid w-full gap-12">
      <CheckerPlay data={data} />
      <Testimonial />
      <GlobalMonitoring />
      <BottomCTA className="mx-auto max-w-2xl lg:max-w-4xl" />
    </div>
  );
}
