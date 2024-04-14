import type { Metadata } from "next";
import {
  Activity,
  Clock,
  FileCode,
  Gauge,
  Palette,
  PanelTop,
} from "lucide-react";

import { BackButton } from "@/components/layout/back-button";
import type { CardProps } from "@/components/play/card";
import { Card } from "@/components/play/card";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "../shared-metadata";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: "Free Tools ",
  openGraph: {
    ...ogMetadata,
    title: "Free Tools",
    url: "https://www.openstatus.dev/play",
  },
  twitter: {
    ...twitterMetadata,
    title: "Free Tools",
  },
};

export default async function PlayPage() {
  return (
    <>
      <BackButton href="/" />
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {playgrounds.map((play, i) => {
          const isFirst = i === 0;
          return (
            <Card
              key={i}
              className={isFirst ? "sm:col-span-2" : undefined}
              {...play}
            />
          );
        })}
      </div>
    </>
  );
}

const playgrounds: CardProps[] = [
  {
    href: "/play/checker",
    title: "Speed Checker",
    description:
      "Get speed insights for your api, website from multiple regions. No account needed.",
    icon: Gauge,
    variant: "primary",
  },
  {
    href: "/public/monitors/1",
    title: "Public Dashboard",
    description: "Get a demo of wha data we collect for your monitor.",
    icon: Activity,
  },
  {
    href: "/play/status",
    title: "Status Page",
    description: "Get a status page for your website or api.",
    icon: PanelTop,
  },
  {
    href: "https://astro.openstat.us",
    title: "Custom Astro Status Page",
    description:
      "Grab your API key and create a custom status page with our Astro starter.",
    icon: Palette,
  },
  {
    href: "https://time.openstatus.dev",
    title: "Shadcn UI Time Picker",
    description:
      "The missing time picker for your next project. Supports 12 hour and 24 hour formats. Fully accessible.",
    icon: Clock,
  },
  {
    href: "https://openstat.us",
    title: "All Status Codes",
    description:
      "Use the endpoint to return the desired error code for testing purposes.",
    icon: FileCode,
  },
];
