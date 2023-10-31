import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { ChevronRight } from "lucide-react";

import { Badge, Button } from "@openstatus/ui";

import { Shell } from "@/components/dashboard/shell";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { Cards, SpecialCard } from "@/components/marketing/cards";
import { FAQs } from "@/components/marketing/faqs";
import { Partners } from "@/components/marketing/partners";
import { Plans } from "@/components/marketing/plans";
import { Stats } from "@/components/marketing/stats";
import { Tracker } from "@/components/tracker";
import { cardConfig, specialCardConfig } from "@/config/features";
import { getGitHubStars } from "@/lib/github";
import { getHomeMonitorListData } from "@/lib/tb";
import { numberFormatter } from "@/lib/utils";

export const revalidate = 600;

export default async function Page() {
  const data = await getHomeMonitorListData();
  const stars = await getGitHubStars();
  return (
    <ClerkProvider>
      <MarketingLayout>
        <div className="grid gap-8">
          <Shell className="text-center">
            <Link
              href="https://twitter.com/mxkaske/status/1685666982786404352?s=20"
              target="_blank"
              rel="noreferrer"
            >
              <Badge variant="outline">
                Announcement Post <ChevronRight className="ml-1 h-3 w-3" />
              </Badge>
            </Link>
            <h1 className="text-foreground font-cal mb-6 mt-2 text-3xl">
              Open-source monitoring service
            </h1>
            <p className="text-muted-foreground mx-auto mb-6 max-w-lg text-lg">
              OpenStatus is an open source monitoring services with incident
              managements.
            </p>
            {/* much better than using flex without text alignment, text stays center even thought not same length */}
            <div className="my-4 grid gap-2 sm:grid-cols-2">
              <div className="text-center sm:block sm:text-right">
                <Button className="w-48 rounded-full sm:w-auto" asChild>
                  <Link href="/app/sign-up">Get Started</Link>
                </Button>
              </div>
              <div className="text-center sm:block sm:text-left">
                <Button
                  variant="outline"
                  className="w-48 rounded-full sm:w-auto"
                  asChild
                >
                  <Link href="/github" target="_blank">
                    Star on GitHub{" "}
                    <Badge variant="secondary" className="ml-1 hidden sm:block">
                      {numberFormatter(stars)}
                    </Badge>
                    <Badge variant="secondary" className="ml-1 block sm:hidden">
                      {stars}
                    </Badge>
                  </Link>
                </Button>
              </div>
            </div>
          </Shell>
          <Shell className="text-center">
            <h2 className="font-cal mb-3 text-2xl">Status</h2>
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/play">Playground</Link>
            </Button>
            <div className="mx-auto max-w-md">
              {data && (
                <Tracker
                  data={data}
                  id="openstatusPing"
                  name="Ping"
                  url="https://www.openstatus.dev/api/ping"
                />
              )}
            </div>
          </Shell>
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
    </ClerkProvider>
  );
}
