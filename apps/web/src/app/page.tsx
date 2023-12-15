import { Shell } from "@/components/dashboard/shell";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { Cards, SpecialCard } from "@/components/marketing/cards";
import { Example } from "@/components/marketing/example";
import { FAQs } from "@/components/marketing/faqs";
import { Hero } from "@/components/marketing/hero";
import { MonitoringCard } from "@/components/marketing/monitoring";
import { Partners } from "@/components/marketing/partners";
import { Plans } from "@/components/marketing/plans";
import { Stats } from "@/components/marketing/stats";
import { StatusMarketing } from "@/components/marketing/status";
import { cardConfig, specialCardConfig } from "@/config/features";

export const revalidate = 600;

export default async function Page() {
  return (
    <MarketingLayout>
      <div className="grid gap-8">
        <Hero />
        <Partners />
        <MonitoringCard {...cardConfig.monitors} />
        <Stats />
        {/* TODO: rename to `reports` */}
        <Cards {...cardConfig.alerts} />
        <StatusMarketing {...cardConfig.pages} />
        {/* <Example /> */}
        {/* <SpecialCard {...specialCardConfig} /> */}
        <Plans />
        <Shell>
          <FAQs />
        </Shell>
      </div>
    </MarketingLayout>
  );
}
