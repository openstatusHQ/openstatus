import type { Region } from "@openstatus/regions";

import {
  getBlogPosts,
  getComparePages,
  getProductPages,
  getToolingPages,
  getToolsPages,
  getUseCasePages,
} from "@/content/utils";

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
      label: "Customers",
      href: "/customers",
    },
    {
      label: "Pricing",
      href: "/pricing",
    },
    {
      label: "Docs",
      href: "/docs",
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
  ],
};

const useCases = getUseCasePages();

const useCasesSection = {
  label: "Use Cases",
  items: useCases
    .sort(
      (a, b) =>
        b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime(),
    )
    .slice(0, 6)
    .map((page) => ({
      label: page.metadata.title,
      href: `/use-case/${page.slug}`,
    })),
};

const resourcesHeaderSection = {
  label: "Resources",
  items: [
    {
      label: "Docs",
      href: "/docs",
    },
    {
      label: "Customers",
      href: "/customers",
    },
    {
      label: "Use Cases",
      href: "/use-case",
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
      label: "Tooling",
      href: "/tooling",
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
      label: "Customers",
      href: "/customers",
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

const blogSection = {
  label: "Blog",
  items: getBlogPosts()
    .sort(
      (a, b) =>
        b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime(),
    )
    .slice(0, 6)
    .map((post) => ({
      label: post.metadata.title,
      href: `/blog/${post.slug}`,
    })),
};

const toolingSection = {
  label: "Tooling",
  items: getToolingPages().map((page) => ({
    label: page.metadata.title,
    href: `/tooling/${page.slug}`,
  })),
};

const compareSection = {
  label: "Compare",
  items: getComparePages()
    .map((page) => ({
      label: page.metadata.title,
      href: `/compare/${page.slug}`,
    }))
    .slice(0, 6),
};

const toolsSection = {
  label: "Tools",
  items: [
    ...getToolsPages()
      .filter((page) => !["severity-matrix"].includes(page.slug))
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
      label: "Twitter",
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
    ...getToolsPages().map((page) => ({
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
  toolingSection,
  resourcesFooterSection,
  compareSection,
  useCasesSection,
  blogSection,
  toolsSection,
  communitySection,
  companySection,
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
