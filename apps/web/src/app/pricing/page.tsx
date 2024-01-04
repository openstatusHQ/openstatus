import { Shell } from "@/components/dashboard/shell";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { Plan } from "@/components/marketing/plans";
import { Pricing } from "@/components/marketing/pricing";
import { plansConfig } from "@/config/plans";

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
          <Pricing />
        </Shell>
        <Shell>
          <Plan {...plansConfig.enterprise} />
        </Shell>
      </div>
    </MarketingLayout>
  );
}
