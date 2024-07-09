import { Chart } from "@/components/monitor-charts/chart";
import { RegionsPreset } from "@/components/monitor-dashboard/region-preset";
import { ResponseDetailTabs } from "@/components/ping-response-analysis/response-detail-tabs";
import { marketingProductPagesConfig } from "@/config/pages";
import { flyRegions } from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/tinybird";
import { Button } from "@openstatus/ui";
import Link from "next/link";
import { Suspense } from "react";
import { AssertionsTimingFormExample } from "../_components/assertions-timing-form-example";
import { Banner } from "../_components/banner";
import { Hero } from "../_components/hero";
import { InteractiveFeature } from "../_components/interactive-feature";
import { mockChartData, mockResponseData } from "../mock";

const { title, description } = marketingProductPagesConfig[0];

export default function FeaturePage() {
  return (
    <div className="grid w-full gap-12">
      <Hero title={title} subTitle={description} />
      <InteractiveFeature
        icon="activity"
        iconText="Website & API monitoring"
        title="From all over the world."
        subTitle="Get insights of the latency."
        component={
          <div className="m-auto">
            <RegionsPreset
              regions={flyRegions as unknown as Region[]}
              selectedRegions={flyRegions as unknown as Region[]}
            />
          </div>
        }
        col={1}
        position={"left"}
      />
      <InteractiveFeature
        icon="book-open-check"
        iconText="Timing & Assertions"
        title="Validate the response."
        subTitle="Check the return value, status code, header or maximum response time."
        component={<AssertionsTimingFormExample />}
        col={2}
        position={"left"}
      />
      <InteractiveFeature
        icon="timer"
        iconText="Request Metrics Insights"
        title="Optimize Web Performance"
        subTitle="Analyze DNS, TCP, TLS, and TTFB for every request and inspect Response Headers as needed."
        component={
          <ResponseDetailTabs
            {...mockResponseData}
            defaultOpen="timing"
            hideInfo={false}
          />
        }
        col={2}
        position={"left"}
      />
      <InteractiveFeature
        icon="line-chart"
        iconText="Charts"
        title="Opinionated Dashboard"
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
      />
      <Banner />
    </div>
  );
}
