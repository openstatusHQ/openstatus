import Link from "next/link";

import { Shell } from "@/components/dashboard/shell";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { EnterpricePlan } from "@/components/marketing/pricing/enterprice-plan";
import { PricingWrapper } from "@/components/marketing/pricing/pricing-wrapper";

export default function PricingPage() {
  return (
    <MarketingLayout>
      <div className="grid w-full gap-6">
        <Shell className="grid w-full gap-8">
          <div className="grid gap-3 text-center">
            <h1 className="text-foreground font-cal text-4xl">Pricing</h1>
            <p className="text-muted-foreground">
              All plans. Start free today, upgrade later.
            </p>
          </div>
          <PricingWrapper />
          <p className="text-muted-foreground text-sm">
            Learn more about the{" "}
            <Link
              href="/blog/our-new-pricing-explained"
              className="text-foreground underline underline-offset-4 hover:no-underline"
            >
              decision behind the plans
            </Link>
            .
          </p>
        </Shell>
        <Shell>
          <EnterpricePlan />
        </Shell>
      </div>
    </MarketingLayout>
  );
}
