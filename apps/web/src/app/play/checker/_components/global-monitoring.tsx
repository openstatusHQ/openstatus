import Link from "next/link";

import { Button } from "@openstatus/ui/src/components/button";

import type { ValidIcon } from "@/components/icons";
import {
  CardContainer,
  CardFeature,
  CardHeader,
  CardIcon,
  CardTitle,
} from "@/components/marketing/card";

const features: {
  icon: ValidIcon;
  catchline: string;
  description: string;
}[] = [
  {
    icon: "gauge",
    catchline: "Speed Test for Websites",
    description:
      "Optimize your website’s performance with our global speed checker. Get insights on page load times across various regions, ensuring your site delivers a fast and seamless experience worldwide.",
  },
  {
    icon: "globe",
    catchline: "Multi-Region Performance Monitoring",
    description:
      "Evaluate your website’s global latency with our multi-region speed test. Monitor performance in different regions to ensure quick load times for users across the planet.",
  },
];
export const GlobalMonitoring = () => {
  return (
    <CardContainer>
      <CardHeader>
        <CardIcon icon="activity" />
        <CardTitle>Start monitoring your services</CardTitle>
      </CardHeader>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {features?.map((feature, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
          <CardFeature key={i} {...feature} />
        ))}
      </ul>
      <div className="order-first flex items-center justify-center gap-2 text-center md:order-none">
        <Button variant="outline" className="rounded-full" asChild>
          <Link href="/features/status-page">Status Page</Link>
        </Button>
        <Button className="rounded-full" asChild>
          <Link href="/features/monitoring">Monitoring</Link>
        </Button>
      </div>
    </CardContainer>
  );
};
