import { MarketingLayout } from "@/components/layout/marketing-layout";
import { AlertCard } from "@/components/marketing/alert/card";
import { FAQs } from "@/components/marketing/faqs";
import { Hero } from "@/components/marketing/hero";
import { MonitoringCard } from "@/components/marketing/monitor/card";
import { Partners } from "@/components/marketing/partners";
import { Stats } from "@/components/marketing/stats";
import { StatusPageCard } from "@/components/marketing/status-page/card";

export const revalidate = 600;

export default async function Page() {
  return (
    <MarketingLayout>
      <div className="grid gap-8">
        <Hero />
        <Partners />
        <MonitoringCard />
        <Stats />
        <StatusPageCard />
        <AlertCard />
        <FAQs />
      </div>
    </MarketingLayout>
  );
}
