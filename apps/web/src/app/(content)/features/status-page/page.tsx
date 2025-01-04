import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { PasswordFormSuspense } from "@/app/status-page/[domain]/_components/password-form";
import { SubscribeButton } from "@/app/status-page/[domain]/_components/subscribe-button";
import { MaintenanceContainer } from "@/components/status-page/maintenance";
import { StatusCheck } from "@/components/status-page/status-check";
import { StatusReport } from "@/components/status-page/status-report";
import { marketingProductPagesConfig } from "@/config/pages";
import { Button, InputWithAddons } from "@openstatus/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { Banner } from "../_components/banner";
import { Hero } from "../_components/hero";
import { InteractiveFeature } from "../_components/interactive-feature";
import { TrackerWithVisibilityToggle } from "../_components/tracker-example";
import { maintenanceData, statusReportData } from "../mock";

const { description, subtitle } = marketingProductPagesConfig[1];

export const metadata: Metadata = {
  ...defaultMetadata,
  title: "Status Page",
  description:
    "Easily report to your users with our public or private status page.",
  twitter: {
    ...twitterMetadata,
    title: "Status Page",
    description:
      "Easily report to your users with our public or private status page.",
  },
  openGraph: {
    ...ogMetadata,
    title: "Status Page",
    description:
      "Easily report to your users with our public or private status page.",
  },
};

export default function FeaturePage() {
  return (
    <div className="grid w-full gap-12">
      <Hero title={description} subTitle={subtitle} />
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
        component={<TrackerWithVisibilityToggle />}
        col={2}
        position={"left"}
      />
      <InteractiveFeature
        icon="users"
        iconText="Reach your users"
        title="Subscriptions."
        subTitle="Let your users subscribe to your status page, to automatically receive updates about the status of your services."
        component={
          <div className="m-auto">
            <SubscribeButton plan="pro" slug={""} isDemo />
          </div>
        }
        col={1}
        position={"left"}
      />
      <InteractiveFeature
        icon="search-check"
        iconText="Stay up to date"
        title="Status Updates."
        subTitle="Down't let your users in the dark and show what's wrong."
        component={
          <div className="-translate-y-6 m-auto scale-[0.80]">
            <StatusReport isDemo {...statusReportData} />
          </div>
        }
        col={1}
        position={"bottom"}
        withGradient
      />
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
        position={"left"}
      />
      <InteractiveFeature
        icon="user"
        iconText="Keep it simple"
        title="Build trust."
        subTitle="Showcase your reliability to your users, and reduce the number of customer service tickets."
        component={<StatusCheck />}
        action={
          <div className="mt-2">
            <Button variant="outline" className="rounded-full" asChild>
              <Link href="https://status.openstatus.dev">Status Page</Link>
            </Button>
          </div>
        }
        col={2}
        position={"bottom"}
      />
      <InteractiveFeature
        icon="hammer"
        iconText="Handle migrations"
        title="Maintenance."
        subTitle="Mute your monitors for a specific period and inform the users about upcoming maintenance."
        component={
          <div className="m-auto scale-[0.80]">
            <MaintenanceContainer
              className="rounded-lg border-status-monitoring/10 bg-status-monitoring/5"
              {...maintenanceData}
            />
          </div>
        }
        col={2}
        position={"left"}
      />
      <Banner />
    </div>
  );
}
