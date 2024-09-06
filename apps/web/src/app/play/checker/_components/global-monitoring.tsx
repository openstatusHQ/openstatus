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
    catchline: "Speed Test",
    description:
      "Enter your URL and get a website speed check. Get insights on page load, header details and timing phases (DNS, Connect, TLS, TTFB, Transfer) of the response.",
  },
  {
    icon: "globe",
    catchline: "Global Latency",
    description:
      "Monitor performance in different regions to ensure quick load times for users across 35 regions around the world.",
  },
  {
    icon: "link",
    catchline: "Share the Results",
    description:
      "Quickly share the results of your website speed test with your team or clients. The results expire after 7 days, so you can easily collaborate on performance.",
  },
];
export const GlobalMonitoring = () => {
  return (
    <CardContainer>
      <CardHeader>
        <CardIcon icon="activity" />
        <CardTitle>Start monitoring your services</CardTitle>
      </CardHeader>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
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
