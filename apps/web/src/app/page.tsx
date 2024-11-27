import { MarketingLayout } from "@/components/layout/marketing-layout";
import { AlertCard } from "@/components/marketing/alert/card";
import { Hero } from "@/components/marketing/hero";
import { BottomCTA, MiddleCTA } from "@/components/marketing/in-between-cta";
import { LatestChangelogs } from "@/components/marketing/lastest-changelogs";
import { MonitoringCard } from "@/components/marketing/monitor/card";
import { Partners } from "@/components/marketing/partners";
import { Stats } from "@/components/marketing/stats";
import { StatusPageCard } from "@/components/marketing/status-page/card";

export const revalidate = 600;

export default async function Page() {
  return (
    <MarketingLayout>
      <div className="grid gap-12">
        <Hero />
        <Partners />
        <MonitoringCard />
        <Stats />
        <MiddleCTA />
        <StatusPageCard />
        <AlertCard />
        <BottomCTA />
        <LatestChangelogs />
      </div>
    </MarketingLayout>
  );
}
