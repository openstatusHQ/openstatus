import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Mdx } from "@/components/content/mdx";
import { Chart } from "@/components/monitor-charts/chart";
import { RegionsPreset } from "@/components/monitor-dashboard/region-preset";
import { ResponseDetailTabs } from "@/components/ping-response-analysis/response-detail-tabs";
import { marketingProductPagesConfig } from "@/config/pages";
import { type Region, flyRegions } from "@openstatus/db/src/schema/constants";
import { Button } from "@openstatus/ui/src/components/button";
import { Skeleton } from "@openstatus/ui/src/components/skeleton";
import { allUnrelateds } from "content-collections";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AssertionsTimingFormExample } from "../_components/assertions-timing-form-example";
import { Banner } from "../_components/banner";
import { Hero } from "../_components/hero";
import { InteractiveFeature } from "../_components/interactive-feature";
import { mockChartData, mockResponseData } from "../mock";

const { description, subtitle } = marketingProductPagesConfig[0];
const code = allUnrelateds.find(
  (unrelated) => unrelated.slug === "ci-cd-features-block",
);

export const metadata: Metadata = {
  ...defaultMetadata,
  title: "API & Website Monitoring",
  description:
    "Get insights of the latency of your API and website from all over the world.",
  twitter: {
    ...twitterMetadata,
    title: "API & Website Monitoring",
    description:
      "Get insights of the latency of your API and website from all over the world.",
  },
  openGraph: {
    ...ogMetadata,
    title: "API & Website Monitoring",
    description:
      "Get insights of the latency of your API and website from all over the world.",
  },
};

export default function FeaturePage() {
  return (
    <div className="grid w-full gap-12">
      <Hero title={description} subTitle={subtitle} />
      <InteractiveFeature
        icon="activity"
        iconText="Website & API monitoring"
        title="Global Monitoring."
        subTitle="Get insights of the latency worldwide."
        component={
          <Suspense fallback={<Skeleton />}>
            <div className="m-auto">
              <RegionsPreset
                regions={flyRegions as unknown as Region[]}
                selectedRegions={flyRegions as unknown as Region[]}
              />
            </div>
          </Suspense>
        }
        col={1}
        position={"left"}
      />
      <InteractiveFeature
        icon="book-open-check"
        iconText="Timing & Assertions"
        title="Validate the response."
        subTitle="Check the return value, status code, header or maximum response time."
        component={
          <Suspense fallback={<Skeleton />}>
            <AssertionsTimingFormExample />{" "}
          </Suspense>
        }
        col={2}
        position={"left"}
        withGradient
      />
      <InteractiveFeature
        icon="timer"
        iconText="Request Metrics Insights"
        title="Optimize Web Performance."
        subTitle="Analyze DNS, TCP, TLS, and TTFB for every request and inspect Response Headers as needed."
        component={
          <Suspense fallback={<Skeleton />}>
            <ResponseDetailTabs
              {...mockResponseData}
              defaultOpen="timing"
              hideInfo={false}
            />
          </Suspense>
        }
        col={2}
        position={"left"}
        withGradient
      />
      <InteractiveFeature
        icon="line-chart"
        iconText="Charts"
        title="Opinionated Dashboard."
        subTitle="Keep an overview about Uptime, P50, P75, P90, P95, P99 of your monitors."
        action={
          <div className="mt-2">
            <Button variant="outline" className="rounded-full" asChild>
              <Link href="/public/monitors/1">Public Dashboard</Link>
            </Button>
          </div>
        }
        component={
          <Suspense fallback={"loading..."}>
            <Chart {...mockChartData} />
          </Suspense>
        }
        col={2}
        position={"top"}
        withGradient
      />
      <InteractiveFeature
        icon="bot"
        iconText="API Monitoring"
        title="Synthetic Monitoring."
        subTitle="Run your check in your CI/CD pipeline or on demand."
        component={
          code ? (
            <Mdx
              code={code.mdx}
              className="max-w-none prose-pre:overflow-hidden"
            />
          ) : (
            <p>Code not found</p>
          )
        }
        action={
          <div className="mt-2">
            <Button variant="outline" className="rounded-full" asChild>
              <Link href="https://docs.openstatus.dev/cli/getting-started">
                How-to
              </Link>
            </Button>
          </div>
        }
        col={2}
        position={"bottom"}
        withGradient
      />
      <Banner />
    </div>
  );
}
