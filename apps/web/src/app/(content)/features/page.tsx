import { Chart } from "@/components/monitor-charts/chart";
import { RegionsPreset } from "@/components/monitor-dashboard/region-preset";
import { ResponseDetailTabs } from "@/components/ping-response-analysis/response-detail-tabs";
import { flyRegions } from "@openstatus/db/src/schema";
import type { Region } from "@openstatus/tinybird";
import { Button, InputWithAddons, Separator } from "@openstatus/ui";
import Link from "next/link";
import { Suspense } from "react";
import { AssertionsTimingFormExample } from "./_examples/assertions-timing-form-example";
import { SubscribeButton } from "@/app/status-page/[domain]/_components/subscribe-button";
import { Tracker } from "@/components/tracker/tracker";
import { InteractiveFeature } from "./_components/interactive-feature";
import { mockChartData, mockResponseData, mockTrackerData } from "./mock";

export default function FeaturePage() {
  return (
    <div className="grid w-full gap-12">
      <FeatureCategoryTitle>Monitors</FeatureCategoryTitle>
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
      <FeatureCategoryTitle>Status Pages</FeatureCategoryTitle>
      <InteractiveFeature
        icon="globe"
        iconText="Customize"
        title="Custom Domain."
        subTitle="Bring your own domain, give the status page a personal touch."
        component={
          <div className="m-auto">
            <InputWithAddons leading="https://" placeholder="status.acme.com" />
          </div>
        }
        col={1}
        position={"left"}
      />
      <InteractiveFeature
        icon="panel-top"
        iconText="Simple by default"
        title="Status page."
        subTitle="Connect your monitors and inform your users about the uptime."
        component={
          <div className="my-auto">
            <Tracker
              data={mockTrackerData}
              name="OpenStatus"
              description="Website Health"
            />
          </div>
        }
        col={2}
        position={"left"}
      />
      <InteractiveFeature
        icon="users"
        iconText="Reach your users"
        title="Subscriptions"
        subTitle="Let your users subscribe to your status page, to automatically receive updates about the status of your services."
        component={
          <div className="m-auto">
            <SubscribeButton slug={""} isDemo />
          </div>
        }
        col={1}
        position={"left"}
      />
    </div>
  );
}

function FeatureCategoryTitle({
  children,
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div className="grid gap-3">
      <h2 className="font-cal text-3xl">{children}</h2>
      <Separator />
    </div>
  );
}
