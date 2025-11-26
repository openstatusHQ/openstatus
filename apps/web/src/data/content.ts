import {
  getComparePages,
  getProductPages,
  getToolsPages,
} from "@/content/utils";
import { Region } from "@openstatus/regions";

const products = getProductPages();

const productsSection = {
  label: "Products",
  items: products.map((product) => ({
    label: product.metadata.title,
    href: `/landing/${product.slug}`,
  })),
};

const resourcesFooterSection = {
  label: "Resources",
  items: [
    {
      label: "Blog",
      href: "/landing/blog",
    },
    {
      label: "Pricing",
      href: "/landing/pricing",
    },
    {
      label: "Docs",
      href: "https://docs.openstatus.dev",
    },
    {
      label: "External Status",
      href: "/landing/status",
    },
    {
      label: "OSS Friends",
      href: "/landing/oss-friends",
    },
  ],
};

const resourcesHeaderSection = {
  label: "Resources",
  items: [
    {
      label: "Blog",
      href: "/landing/blog",
    },
    {
      label: "Changelog",
      href: "/landing/changelog",
    },
    {
      label: "Global Speed Checker",
      href: "/landing/play/checker",
    },
    {
      label: "Compare",
      href: "/landing/compare",
    },
    {
      label: "Playground (Tools)",
      href: "/landing/play",
    },
  ],
};

const companySection = {
  label: "Company",
  items: [
    {
      label: "About",
      href: "/landing/about",
    },
    {
      label: "Changelog",
      href: "/landing/changelog",
    },
    {
      label: "I'm an LLM",
      href: "https://www.openstatus.dev/llms.txt",
    },
    {
      label: "Terms",
      href: "/landing/terms",
    },
    {
      label: "Privacy",
      href: "/landing/privacy",
    },
    {
      label: "Subprocessors",
      href: "/landing/subprocessors",
    },
  ],
};

const compareSection = {
  label: "Compare",
  items: getComparePages().map((page) => ({
    label: page.metadata.title,
    href: `/landing/compare/${page.slug}`,
  })),
};

const toolsSection = {
  label: "Tools",
  items: [
    ...getToolsPages()
      .filter((page) => page.slug !== "checker-slug")
      .map((page) => ({
        label: page.metadata.title,
        href: `/landing/play/${page.slug}`,
      })),
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
      href: "https://openstatus.dev/x",
    },
    {
      label: "BlueSky",
      href: "https://openstatus.dev/bluesky",
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
        href: `/landing/play/${page.slug}`,
      })),
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
