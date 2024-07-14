import type { Metadata } from "next";

import { BackButton } from "@/components/layout/back-button";
import CheckerPlay from "./_components/checker-play";
import { Testimonial } from "./_components/testimonial";
import { BottomCTA } from "@/components/marketing/in-between-cta";
import { GlobalMonitoring } from "./_components/global-monitoring";

export const metadata: Metadata = {
  title: "Speed Checker",
  description:
    "Test the performance your api, website from multiple regions. Get speed insights for free.",
  openGraph: {
    title: "Speed Checker",
    description:
      "Test the performance your api, website from multiple regions. Get speed insights for free.",
  },
};

export default async function PlayPage() {
  return (
    <div className="my-8 grid h-full w-full gap-12 md:my-16">
      <CheckerPlay />
      <Testimonial />
      <GlobalMonitoring />
      <div className="mx-auto max-w-2xl lg:max-w-4xl">
        <BottomCTA />
      </div>
    </div>
  );
}
