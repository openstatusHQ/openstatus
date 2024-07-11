import { PasswordFormSuspense } from "@/app/status-page/[domain]/_components/password-form";
import { SubscribeButton } from "@/app/status-page/[domain]/_components/subscribe-button";
import { MaintenanceBanner } from "@/components/status-page/maintenance-banner";
import { StatusCheck } from "@/components/status-page/status-check";
import { StatusReport } from "@/components/status-page/status-report";
import { Tracker } from "@/components/tracker/tracker";
import { marketingProductPagesConfig } from "@/config/pages";
import { Button, InputWithAddons } from "@openstatus/ui";
import Link from "next/link";
import { Banner } from "../_components/banner";
import { Hero } from "../_components/hero";
import { InteractiveFeature } from "../_components/interactive-feature";
import { maintenanceData, mockTrackerData, statusReportData } from "../mock";

const { title, description } = marketingProductPagesConfig[1];

export default function FeaturePage() {
  return (
    <div className="grid w-full gap-12">
      <Hero title={title} subTitle={description} />
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
        title="Subscriptions."
        subTitle="Let your users subscribe to your status page, to automatically receive updates about the status of your services."
        component={
          <div className="m-auto">
            <SubscribeButton slug={""} isDemo />
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
            <StatusReport {...statusReportData} />
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
        component={
          <div className="m-auto max-w-lg">
            <StatusCheck />
          </div>
        }
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
          <div className="m-auto">
            <MaintenanceBanner {...maintenanceData} />
          </div>
        }
        col={2}
        position={"left"}
      />
      <Banner />
    </div>
  );
}
