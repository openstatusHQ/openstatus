import {
  getComparePages,
  getProductPages,
  getToolsPages,
} from "@/content/utils";
import type { Region } from "@openstatus/regions";

const products = getProductPages();

const productsSection = {
  label: "Products",
  items: products.map((product) => ({
    label: product.metadata.title,
    href: `/${product.slug}`,
  })),
};

const resourcesFooterSection = {
  label: "Resources",
  items: [
    {
      label: "Blog",
      href: "/blog",
    },
    {
      label: "Pricing",
      href: "/pricing",
    },
    {
      label: "Docs",
      href: "https://docs.openstatus.dev",
    },
    {
      label: "Guides",
      href: "/guides",
    },
    {
      label: "External Status",
      href: "/status",
    },
    {
      label: "OSS Friends",
      href: "/oss-friends",
    },
    {
      label: "Marketing V1",
      href: "https://v1.openstatus.dev",
    },
  ],
};

const resourcesHeaderSection = {
  label: "Resources",
  items: [
    {
      label: "Docs",
      href: "https://docs.openstatus.dev",
    },
    {
      label: "Blog",
      href: "/blog",
    },
    {
      label: "Changelog",
      href: "/changelog",
    },
    {
      label: "Global Speed Checker",
      href: "/play/checker",
    },
    {
      label: "Compare",
      href: "/compare",
    },
  ],
};

const companySection = {
  label: "Company",
  items: [
    {
      label: "About",
      href: "/about",
    },
    {
      label: "Changelog",
      href: "/changelog",
    },
    {
      label: "I'm an LLM",
      href: "https://www.openstatus.dev/llms.txt",
    },
    {
      label: "Terms",
      href: "/terms",
    },
    {
      label: "Privacy",
      href: "/privacy",
    },
    {
      label: "Subprocessors",
      href: "/subprocessors",
    },
  ],
};

const compareSection = {
  label: "Compare",
  items: getComparePages()
    .map((page) => ({
      label: page.metadata.title,
      href: `/compare/${page.slug}`,
    }))
    .slice(0, 7),
};

const toolsSection = {
  label: "Tools",
  items: [
    ...getToolsPages()
      .filter(
        (page) => !["checker-slug", "severity-matrix"].includes(page.slug),
      )
      .map((page) => ({
        label: page.metadata.title,
        href: `/play/${page.slug}`,
      })),
    {
      label: "Shadcn Component Registry",
      href: "/registry",
    },
    {
      label: "Theme Explorer",
      href: "https://themes.openstatus.dev",
    },
    {
      label: "All Status Codes",
      href: "https://openstat.us",
    },
    {
      label: "Vercel Edge Ping",
      href: "https://light.openstatus.dev",
    },
  ],
};

const communitySection = {
  label: "Community",
  items: [
    {
      label: "Discord",
      href: "https://openstatus.dev/discord",
    },
    {
      label: "GitHub",
      href: "https://openstatus.dev/github",
    },
    {
      label: "X",
      href: "https://openstatus.dev/twitter",
    },
    {
      label: "BlueSky",
      href: "https://openstatus.dev/bsky",
    },
    {
      label: "YouTube",
      href: "https://openstatus.dev/youtube",
    },
    {
      label: "LinkedIn",
      href: "https://openstatus.dev/linkedin",
    },
  ],
};

export const playSection = {
  label: "Play",
  items: [
    ...getToolsPages()
      .filter((page) => page.slug !== "checker-slug")
      .map((page) => ({
        label: page.metadata.title,
        href: `/play/${page.slug}`,
      })),
    {
      label: "Theme Explorer",
      href: "https://themes.openstatus.dev",
    },
    {
      label: "Shadcn Component Registry",
      href: "/registry",
    },
    {
      label: "All Status Codes",
      href: "https://openstat.us",
    },
    {
      label: "Vercel Edge Ping",
      href: "https://light.openstatus.dev",
    },
    {
      label: "React Data Table",
      href: "https://logs.run",
    },
    {
      label: "Shadcn Time Picker",
      href: "https://time.openstatus.dev",
    },
    {
      label: "Astro Status Page",
      href: "https://astro.openstat.us",
    },
  ],
};

export const headerLinks = [productsSection, resourcesHeaderSection];

export const footerLinks = [
  productsSection,
  resourcesFooterSection,
  companySection,
  compareSection,
  toolsSection,
  communitySection,
];

// --------------------------------

export type RegionMetricsChartTable = {
  region: Region;
  count: number;
  ok: number;
  p50Latency: number | null;
  p75Latency: number | null;
  p90Latency: number | null;
  p95Latency: number | null;
  p99Latency: number | null;
};
