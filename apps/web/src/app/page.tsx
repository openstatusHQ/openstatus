import Link from "next/link";

import { Shell } from "@/components/dashboard/shell";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { Cards } from "@/components/marketing/cards";
import { FAQs } from "@/components/marketing/faqs";
import { Tracker } from "@/components/tracker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMonitorListData } from "@/lib/tb";
import { HeroForm } from "./_components/hero-form";

export default async function Page() {
  const data = await getMonitorListData({ monitorId: "openstatusPing" });

  return (
    <MarketingLayout>
      <div className="grid gap-8">
        <Shell className="text-center">
          <Badge>Coming Soon</Badge>
          <h1 className="text-foreground font-cal mb-6 mt-2 text-3xl">
            Open-source monitoring service
          </h1>
          <p className="text-muted-foreground mx-auto max-w-lg">
            OpenStatus is an open source alternative to your current monitoring
            service with a beautiful status page.
          </p>
          {/* think of using the `A total of X events as Link as well */}
          <div className="my-4 flex items-center justify-center gap-2">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/play">Playground</Link>
            </Button>
            <Button asChild variant="link">
              <a
                href="https://github.com/openstatushq/openstatus"
                rel="noreferrer"
                target="_blank"
              >
                Star on GitHub
              </a>
            </Button>
          </div>
          <div className="mx-auto max-w-lg">
            <HeroForm />
          </div>
        </Shell>
        <Shell>
          <h2 className="font-cal mb-3 text-center text-2xl">Status</h2>
          {data && (
            <Tracker
              data={data}
              id="openstatusPing"
              name="Ping"
              url="https://www.openstatus.dev/api/ping"
            />
          )}
        </Shell>
        <Cards />
        <Shell>
          <FAQs />
        </Shell>
      </div>
    </MarketingLayout>
  );
}
