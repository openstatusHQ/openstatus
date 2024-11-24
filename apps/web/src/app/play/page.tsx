import {
  Activity,
  Clock,
  FileCode,
  Gauge,
  Package,
  Palette,
  PanelTop,
  Table,
  Terminal,
} from "lucide-react";
import type { Metadata } from "next";

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
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {playgrounds.map((play, i) => {
          const isFirst = i === 0;
          return (
            <Card
              key={play.href}
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
    title: "Global Speed Checker",
    description:
      "Get speed insights for your api, website from multiple regions. No account needed.",
    icon: Gauge,
    variant: "primary",
  },
  {
    href: "/play/curl",
    title: "cURL Builder",
    description: "Easily generate curl commands to test your API endpoints.",
    icon: Terminal,
  },
  {
    href: "https://light.openstatus.dev",
    title: "Vercel Edge Ping",
    description:
      "Lightweight one-click self-hostable checker for vercel's edge network.",
    icon: Package,
  },
  {
    href: "/public/monitors/1",
    title: "Public Dashboard",
    description: "Get a demo of what data we collect for your monitor.",
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
  {
    href: "https://logs.run",
    title: "Data Table Demo",
    description:
      "Tanstack table with sorting, filtering, and infinite scroll. Combined with cmdk.",
    icon: Table,
  },
];
