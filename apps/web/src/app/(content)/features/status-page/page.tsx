import { InputWithAddons } from "@openstatus/ui";
import { SubscribeButton } from "@/app/status-page/[domain]/_components/subscribe-button";
import { Tracker } from "@/components/tracker/tracker";
import { InteractiveFeature } from "../_components/interactive-feature";
import { mockTrackerData } from "../mock";
import { marketingProductPagesConfig } from "@/config/pages";
import { Hero } from "../_components/hero";
import { Banner } from "../_components/banner";

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
      <Banner />
    </div>
  );
}
