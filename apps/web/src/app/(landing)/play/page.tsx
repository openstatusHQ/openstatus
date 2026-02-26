import { components } from "@/content/mdx";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import type { Metadata } from "next";
import {
  ContentBoxDescription,
  ContentBoxLink,
  ContentBoxTitle,
  ContentBoxUrl,
} from "../content-box";

const TITLE = "Playground (Tools)";
const DESCRIPTION = "Playground for tools and services related to OpenStatus.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    ...ogMetadata,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    ...twitterMetadata,
    title: TITLE,
    description: DESCRIPTION,
    images: [`/api/og?title=${TITLE}&description=${DESCRIPTION}`],
  },
};

export default function Page() {
  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>Playground (Tools)</h1>
      <components.Grid cols={2}>
        {PLAY.map((tool) => (
          <ContentBoxLink key={tool.href} href={tool.href}>
            <ContentBoxTitle>{tool.label}</ContentBoxTitle>
            <ContentBoxDescription>{tool.description}</ContentBoxDescription>
            <ContentBoxUrl url={tool.href} />
          </ContentBoxLink>
        ))}
      </components.Grid>
    </section>
  );
}

const PLAY = [
  {
    label: "Global Speed Checker",
    description: "Test the latency of your website worldwide",
    href: "/play/checker",
  },
  {
    label: "cURL Builder",
    description: "Curl your website",
    href: "/play/curl",
  },
  {
    label: "Uptime SLA Calculator",
    description: "Calculate downtime duration or uptime percentage",
    href: "/play/uptime-sla",
  },
  {
    label: "Theme Explorer",
    description: "Explore themes for your status page",
    href: "https://themes.openstatus.dev",
  },
  {
    label: "Incident Severity Matrix Builder",
    description: "Classify incidents with deterministic, auditable rules",
    href: "/play/severity-matrix",
  },
  {
    label: "All Status Codes",
    description: "Explore all HTTP status codes",
    href: "https://openstat.us",
  },
  {
    label: "Vercel Edge Ping",
    description: "Use edge functions to ping your website",
    href: "https://light.openstatus.dev",
  },
  {
    label: "React Data Table",
    description: "Shadcn tanstack table with nuqs integration",
    href: "https://logs.run",
  },
  {
    label: "Shadcn Time Picker",
    description: "Shadcn time picker with date-fns integration",
    href: "https://time.openstatus.dev",
  },
  {
    label: "Astro Status Page",
    description: "Astro status page with openstatus integration",
    href: "https://astro.openstat.us",
  },
  {
    label: "Open-source templates",
    description: "Template for dashboard, statuspage and marketing",
    href: "https://template.openstatus.dev",
  },
];
