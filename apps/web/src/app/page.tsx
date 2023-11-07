import { Shell } from "@/components/dashboard/shell";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { Cards, SpecialCard } from "@/components/marketing/cards";
import { Example } from "@/components/marketing/example";
import { FAQs } from "@/components/marketing/faqs";
import { Hero } from "@/components/marketing/hero";
import { Partners } from "@/components/marketing/partners";
import { Plans } from "@/components/marketing/plans";
import { Stats } from "@/components/marketing/stats";
import { cardConfig, specialCardConfig } from "@/config/features";

export const revalidate = 600;

export default async function Page() {
  return (
    <MarketingLayout>
      <div className="grid gap-8">
        <Hero />
        <Example />
        <Cards {...cardConfig.monitors} />
        <Stats />
        <Cards {...cardConfig.incidents} />
        <Partners />
        <Cards {...cardConfig.pages} />
        <SpecialCard {...specialCardConfig} />
        <Plans />
        <Shell>
          <FAQs />
        </Shell>
      </div>
    </MarketingLayout>
  );
}
