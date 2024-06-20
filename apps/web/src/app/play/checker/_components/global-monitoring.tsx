import Link from "next/link";

import { Button } from "@openstatus/ui";

import {
  CardContainer,
  CardFeature,
  CardFeatureContainer,
  CardIcon,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/marketing/card";
import { Globe } from "@/components/marketing/monitor/globe";
import type { ValidIcon } from "@/components/icons";
import { Shell } from "@/components/dashboard/shell";

const features: {
  icon: ValidIcon;
  catchline: string;
  description: string;
}[] = [
  {
    icon: "globe",
    catchline: "Latency Monitoring.",
    description:
      "Monitor the latency of your endpoints from all over the world. We support 35 regions.",
  },
  {
    icon: "play",
    catchline: "Monitor anything.",
    description:
      "We can monitor your website, API, DNS, TCP or any other service you have running. ",
  },
  {
    icon: "bot",
    catchline: "Synthetic Monitoring.",
    description: "Run your tests in your CI/CD pipeline, or on a schedule. ",
  },
];
export const GlobalMonitoring = () => {
  return (
    <Shell className="mx-auto">
      <CardHeader>
        <CardIcon icon={"activity"} />
        <CardTitle>Start monitoring your services</CardTitle>
      </CardHeader>
      <>
        <div className="mt-12">
          <div className="list-none space-y-4">
            {features?.map((feature, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
              <CardFeature key={i} {...feature} />
            ))}
          </div>
        </div>
      </>
    </Shell>
  );
};
