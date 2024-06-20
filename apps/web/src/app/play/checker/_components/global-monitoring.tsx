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
      "We can monitor your website, API, DNS, TCP or any other service you have running.",
  },
  {
    icon: "bot",
    catchline: "Synthetic Monitoring.",
    description:
      "Run your tests in your CI/CD pipeline, or on a schedule. We can monitor it all.",
  },
];
export const GlobalMonitoring = () => {
  return (
    <CardContainer>
      <CardHeader>
        <CardIcon icon={"activity"} />
        <CardTitle>Global Monitoring</CardTitle>
      </CardHeader>
      <CardContent>
        <Globe />
        <CardFeatureContainer>
          {features?.map((feature, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
            <CardFeature key={i} {...feature} />
          ))}
          <div className="order-first text-center md:order-none">
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/app/sign-up">Get Started</Link>
            </Button>
          </div>
        </CardFeatureContainer>
      </CardContent>
    </CardContainer>
  );
};
