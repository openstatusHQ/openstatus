import type { Metadata } from "next";

import { BottomCTA } from "@/components/marketing/in-between-cta";
import CheckerPlay from "./_components/checker-play";
import { GlobalMonitoring } from "./_components/global-monitoring";
import { Testimonial } from "./_components/testimonial";

export const metadata: Metadata = {
  title: "Global Speed Checker",
  description:
    "Test the performance of your api, website from multiple regions. Get speed insights for free.",
  openGraph: {
    title: "Global Speed Checker",
    description:
      "Test the performance of your api, website from multiple regions. Get speed insights for free.",
  },
};

export default async function PlayPage() {
  return (
    <div className="grid h-full w-full gap-12">
      <CheckerPlay />
      <Testimonial />
      <GlobalMonitoring />
      <div className="mx-auto max-w-2xl lg:max-w-4xl">
        <BottomCTA />
      </div>
    </div>
  );
}
