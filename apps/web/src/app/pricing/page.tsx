import type { Metadata } from "next";

import { Shell } from "@/components/dashboard/shell";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { FAQs } from "@/components/marketing/faqs";
import { EnterpricePlan } from "@/components/marketing/pricing/enterprice-plan";
import { PricingSlider } from "@/components/marketing/pricing/pricing-slider";
import { PricingWrapperSuspense } from "@/components/marketing/pricing/pricing-wrapper";
import { Separator } from "@openstatus/ui";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "../shared-metadata";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: "Pricing",
  openGraph: {
    ...ogMetadata,
    title: "Pricing",
    url: "https://www.openstatus.dev/pricing",
  },
  twitter: {
    ...twitterMetadata,
    title: "Pricing",
  },
};

export default function PricingPage() {
  return (
    <MarketingLayout>
      <div className="grid w-full gap-6">
        <Shell className="grid w-full gap-12">
          <div className="grid gap-3 text-center">
            <h1 className="font-cal text-4xl text-foreground">Pricing</h1>
            <p className="text-muted-foreground">
              All plans. Start free today, upgrade later.
            </p>
          </div>
          <PricingWrapperSuspense />
          <Separator />
          <PricingSlider />
        </Shell>
        <Shell>
          <EnterpricePlan />
        </Shell>
        <FAQs />
      </div>
    </MarketingLayout>
  );
}
