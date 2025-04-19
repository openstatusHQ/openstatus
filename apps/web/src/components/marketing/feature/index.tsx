import { PasswordFormSuspense } from "@/app/status-page/[domain]/_components/password-form";
import { SubscribeButton } from "@/app/status-page/[domain]/_components/subscribe-button";
import { Mdx } from "@/components/content/mdx";
import { Chart } from "@/components/monitor-charts/chart";
import { RegionsPreset } from "@/components/monitor-dashboard/region-preset";
import { ResponseDetailTabs } from "@/components/ping-response-analysis/response-detail-tabs";
import { MaintenanceContainer } from "@/components/status-page/maintenance";
import { StatusCheck } from "@/components/status-page/status-check";
import { StatusReport } from "@/components/status-page/status-report";
import { Tracker } from "@/components/tracker/tracker";
import type { Region } from "@openstatus/db/src/schema/constants";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { Button, InputWithAddons } from "@openstatus/ui";
import { Skeleton } from "@openstatus/ui/src/components/skeleton";
import { allUnrelateds } from "content-collections";
import Link from "next/link";
import { Suspense } from "react";
import { AssertionsTimingFormExample } from "./assertions-timing-form-example";
import {
  InteractiveFeature,
  type InteractiveFeatureProps,
} from "./interactive-feature";
import {
  maintenanceData,
  mockChartData,
  mockResponseData,
  mockTrackerData,
  statusReportData,
} from "./mock";
import { NotificationsFormExample } from "./notifications-form-example";
import { RaycastExample } from "./raycast-example";
import { TrackerWithVisibilityToggle } from "./tracker-example";

export { BookingBanner } from "../banner/booking-banner";
export { SpeedBanner } from "../banner/speed-banner";

export function FeatureTimingAssertions(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  return (
    <InteractiveFeature
      icon="book-open-check"
      iconText="Timing & Assertions"
      title="Validate the response."
      subTitle="Check the return value, status code, header or maximum response time."
      component={
        <div className="origin-top scale-[0.80]">
          <Suspense fallback={<Skeleton />}>
            <AssertionsTimingFormExample />
          </Suspense>
        </div>
      }
      col={2}
      position={props.position || "left"}
      withGradient
    />
  );
}

export function FeatureNotifications(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  return (
    <InteractiveFeature
      icon="bell"
      iconText="Notifications"
      title="Integrate your channels."
      subTitle="Get notified when your services are down. Slack, Discord, Email, and more."
      component={
        <div className="scale-[0.80] my-auto">
          <NotificationsFormExample />
        </div>
      }
      col={2}
      position={props.position || "right"}
    />
  );
}

export function FeatureStatusPageTracker(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  return (
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
            showValues
          />
        </div>
      }
      col={2}
      position={props.position || "left"}
    />
  );
}

export function FeatureCharts(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  return (
    <InteractiveFeature
      icon="line-chart"
      iconText="Charts"
      title="Opinionated Dashboard."
      subTitle="Keep an overview about Uptime, P50, P75, P90, P95, P99 of your monitors. Share it with your team or make it public."
      action={
        <div className="mt-2">
          <Button variant="outline" className="rounded-full" asChild>
            <Link href="/public/monitors/1">Public Dashboard</Link>
          </Button>
        </div>
      }
      component={
        <div className="origin-top my-auto scale-[0.80]">
          <Suspense fallback={<Skeleton />}>
            <Chart {...mockChartData} />
          </Suspense>
        </div>
      }
      col={2}
      position={props.position || "top"}
      withGradient
    />
  );
}

export function FeatureCustomDomain(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  return (
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
      position={props.position || "left"}
    />
  );
}

export function FeatureStatusPageTrackerToggle(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  return (
    <InteractiveFeature
      icon="panel-top"
      iconText="Simple by default"
      title="Status page."
      subTitle="Connect your monitors and inform your users about the uptime."
      component={<TrackerWithVisibilityToggle />}
      col={2}
      position={props.position || "left"}
    />
  );
}

export function FeatureSubscriptions(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  return (
    <InteractiveFeature
      icon="users"
      iconText="Reach your users"
      title="Subscriptions."
      subTitle="Let your users subscribe to your status page, to automatically receive updates about the status of your services."
      component={
        <div className="m-auto">
          <SubscribeButton plan="team" slug={""} isDemo />
        </div>
      }
      col={1}
      position={props.position || "left"}
    />
  );
}

export function FeatureStatusUpdates(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  return (
    <InteractiveFeature
      icon="search-check"
      iconText="Stay up to date"
      title="Status Updates."
      subTitle="Down't let your users in the dark and show what's wrong."
      component={
        <div className="my-auto origin-top scale-[0.80]">
          <StatusReport isDemo {...statusReportData} />
        </div>
      }
      col={1}
      position={props.position || "bottom"}
      withGradient
    />
  );
}

export function FeaturePasswordProtection(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  return (
    <InteractiveFeature
      icon="eye-off"
      iconText="Restrict access"
      title="Password Protection."
      subTitle="Hide your page to unexepected users."
      component={
        <div className="m-auto max-w-lg">
          <PasswordFormSuspense slug="" />
        </div>
      }
      col={2}
      position={props.position || "left"}
    />
  );
}

export function FeatureOperationalBanner(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  return (
    <InteractiveFeature
      icon="user"
      iconText="Keep it simple"
      title="Build trust."
      subTitle="Showcase your reliability to your users, and reduce the number of customer service tickets."
      component={<StatusCheck />}
      action={
        <Button variant="outline" className="rounded-full" asChild>
          <Link href="https://status.openstatus.dev">Status Page</Link>
        </Button>
      }
      col={2}
      position={props.position || "bottom"}
    />
  );
}

export function FeatureMaintenance(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  return (
    <InteractiveFeature
      icon="hammer"
      iconText="Handle migrations"
      title="Maintenance."
      subTitle="Mute your monitors for a specific period and inform the users about upcoming maintenance."
      component={
        <div className="my-auto scale-[0.80]">
          <MaintenanceContainer
            className="rounded-lg border-status-monitoring/10 bg-status-monitoring/5"
            {...maintenanceData}
          />
        </div>
      }
      col={2}
      position={props.position || "left"}
    />
  );
}

export function FeatureRegions(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  return (
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
      position={props.position || "left"}
    />
  );
}

export function FeatureResponseDetails(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  return (
    <InteractiveFeature
      icon="timer"
      iconText="Request Metrics Insights"
      title="Optimize Web Performance."
      subTitle="Analyze DNS, TCP, TLS, and TTFB for every request and inspect Response Headers as needed."
      component={
        <div className="scale-[0.80] origin-top">
          <Suspense fallback={<Skeleton />}>
            <ResponseDetailTabs
              {...mockResponseData}
              defaultOpen="timing"
              hideInfo={false}
            />
          </Suspense>
        </div>
      }
      col={2}
      position={props.position || "left"}
      withGradient
    />
  );
}

export function FeatureRaycastIntegration(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  return (
    <InteractiveFeature
      icon="command"
      iconText="Raycast"
      title="Command K."
      subTitle="Check status pages and incidents without leaving your flow."
      component={<RaycastExample />}
      action={
        <Button variant="outline" className="rounded-full w-max" asChild>
          <a
            href="https://www.raycast.com/thibaultleouay/openstatus"
            rel="noreferrer"
            target="_blank"
          >
            Raycast Store
          </a>
        </Button>
      }
      col={2}
      position={props.position || "left"}
    />
  );
}

const blockCICD = allUnrelateds.find(
  (unrelated) => unrelated.slug === "ci-cd-features-block",
);

export function FeatureAPIMonitoring(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  if (!blockCICD) {
    throw new Error("CI/CD block not found");
  }

  return (
    <InteractiveFeature
      icon="bot"
      iconText="API Monitoring"
      title="Synthetic Monitoring."
      subTitle="Run your check in your CI/CD pipeline or on demand."
      component={
        <Mdx
          code={blockCICD.mdx}
          className="max-w-none prose-pre:overflow-hidden"
        />
      }
      action={
        <Button variant="outline" className="rounded-full w-max" asChild>
          <a
            href="https://docs.openstatus.dev/cli/getting-started"
            rel="noreferrer"
            target="_blank"
          >
            How-to
          </a>
        </Button>
      }
      col={2}
      position={props.position || "bottom"}
      withGradient
    />
  );
}

const blockTerraform = allUnrelateds.find(
  (unrelated) => unrelated.slug === "terraform-provider-block",
);

export function FeatureTerraformProvider(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  if (!blockTerraform) {
    throw new Error("Terraform block not found");
  }

  return (
    <InteractiveFeature
      icon="bot"
      iconText="Terraform Provider"
      title="Infra as Code."
      subTitle="Use Terraform to manage your monitors."
      component={
        <Mdx
          code={blockTerraform.mdx}
          className="max-w-none prose-pre:overflow-hidden"
        />
      }
      action={
        <Button variant="outline" className="rounded-full w-max" asChild>
          <a
            href="https://registry.terraform.io/providers/openstatusHQ/openstatus/latest"
            rel="noreferrer"
            target="_blank"
          >
            Terraform Registry
          </a>
        </Button>
      }
      col={2}
      position={props.position || "bottom"}
      withGradient
    />
  );
}

const blockGitHubAction = allUnrelateds.find(
  (unrelated) => unrelated.slug === "github-action-block",
);

export function FeatureGitHubAction(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  if (!blockGitHubAction) {
    throw new Error("GitHub Action block not found");
  }

  return (
    <InteractiveFeature
      icon="bot"
      iconText="GitHub Action"
      title="CI/CD pipeline."
      subTitle="Run your check on demand or in your workflows."
      component={
        <Mdx
          code={blockGitHubAction.mdx}
          className="max-w-none prose-pre:overflow-hidden"
        />
      }
      action={
        <Button variant="outline" className="rounded-full w-max" asChild>
          <a
            href="https://github.com/marketplace/actions/openstatus-synthetics-ci"
            rel="noreferrer"
            target="_blank"
          >
            GitHub Action Marketplace
          </a>
        </Button>
      }
      col={2}
      position={props.position || "bottom"}
      withGradient
    />
  );
}

export function FeatureCLI(
  props: Partial<Pick<InteractiveFeatureProps, "position">>,
) {
  const blockCLI = allUnrelateds.find(
    (unrelated) => unrelated.slug === "cli-block",
  );

  if (!blockCLI) {
    throw new Error("CLI block not found");
  }
  return (
    <InteractiveFeature
      icon="bot"
      iconText="CLI"
      title="Run everywhere."
      subTitle="Check your monitors from your favorite terminal."
      component={
        <Mdx
          code={blockCLI.mdx}
          className="max-w-none prose-pre:overflow-hidden my-auto"
        />
      }
      action={
        <Button variant="outline" className="rounded-full w-max" asChild>
          <a
            href="https://docs.openstatus.dev/cli/getting-started"
            rel="noreferrer"
            target="_blank"
          >
            Getting Started
          </a>
        </Button>
      }
      col={2}
      position={props.position || "right"}
    />
  );
}
