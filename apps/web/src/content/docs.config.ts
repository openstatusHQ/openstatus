// Single source of truth for docs section order, page order, and sidebar labels.
// Labels live here because they intentionally differ from page titles
// (e.g. title "Foundational Concepts" → sidebar label "Overview"). Page→section
// membership is mirrored by each doc's `category` frontmatter and cross-checked
// at build time (see `validateDocsNav`).

export type DocsNavItem =
  | { slug: string; label: string }
  | { link: string; label: string; external: true };

export type DocsNavSection = {
  label: string;
  collapsed?: boolean;
  items: DocsNavItem[];
};

export const DOCS_SECTIONS = [
  "Concepts",
  "Tutorials",
  "Guides",
  "SDK",
  "Reference",
  "Help",
] as const;

export type DocsSection = (typeof DOCS_SECTIONS)[number];

export const docsNav: DocsNavSection[] = [
  {
    label: "Concepts",
    items: [
      { slug: "concept/getting-started", label: "Overview" },
      { slug: "concept/uptime-monitoring", label: "About Uptime monitoring" },
      {
        slug: "concept/best-practices-status-page",
        label: "Best Practices for Status Pages",
      },
      {
        slug: "concept/uptime-calculation-and-values",
        label: "Uptime Calculation and Values",
      },
      {
        slug: "concept/uptime-monitoring-as-code",
        label: "Uptime Monitoring as Code",
      },
      {
        slug: "concept/latency-vs-response-time",
        label: "Latency vs Response Time",
      },
    ],
  },
  {
    label: "Tutorials",
    items: [
      { slug: "tutorial/getting-started", label: "Overview" },
      {
        slug: "tutorial/how-to-create-monitor",
        label: "How to create a monitor",
      },
      {
        slug: "tutorial/how-to-create-status-page",
        label: "How to create a status page",
      },
      {
        slug: "tutorial/how-to-configure-status-page",
        label: "How to configure a status page",
      },
      {
        slug: "tutorial/how-to-create-private-location",
        label: "How to create a private location (beta)",
      },
      {
        slug: "tutorial/get-started-with-openstatus-cli",
        label: "Get Started with openstatus CLI",
      },
      {
        slug: "tutorial/how-to-setup-slack-agent",
        label: "How to set up the Slack Agent",
      },
      {
        slug: "tutorial/how-to-connect-openstatus-to-claude-code",
        label: "Connect openstatus to Claude Code",
      },
      {
        slug: "tutorial/how-to-manage-openstatus-with-terraform-cli",
        label: "Manage Your Stack with Terraform and CLI",
      },
      {
        slug: "tutorial/how-to-import-status-page",
        label: "Import a Status Page from Another Provider",
      },
    ],
  },
  {
    label: "Guides",
    items: [
      { slug: "guides/getting-started", label: "Overview" },
      {
        slug: "guides/how-to-monitor-mcp-server",
        label: "Monitor your MCP Server",
      },
      {
        slug: "guides/how-to-run-synthetic-test-github-action",
        label: "Run check in GitHub Actions",
      },
      {
        slug: "guides/how-to-export-metrics-to-otlp-endpoint",
        label: "Export Metrics to your OTLP Endpoint",
      },
      {
        slug: "guides/how-to-add-svg-status-badge",
        label: "How to Add an SVG Status Badge to your GitHub README",
      },
      {
        slug: "guides/how-to-use-react-widget",
        label: "How to use React Status Widget",
      },
      {
        slug: "guides/how-to-deploy-probes-cloudflare-containers",
        label: "How to deploy probes on Cloudflare Containers",
      },
      {
        slug: "guides/self-hosting-openstatus",
        label: "How to self-host openstatus",
      },
      {
        slug: "guides/self-host-status-page-only",
        label: "Self host Status Page only",
      },
      {
        slug: "guides/how-deploy-status-page-cf-pages",
        label: "Deploy a status page on Cloudflare Pages",
      },
      {
        slug: "guides/how-to-translate-status-page",
        label: "How to translate your status page",
      },
      {
        slug: "guides/how-to-embed-status-page-iframe",
        label: "How to embed a status page in an iframe",
      },
    ],
  },
  {
    label: "SDK",
    collapsed: true,
    items: [
      { slug: "sdk/nodejs", label: "Node SDK" },
      { slug: "sdk/nodejs/getting-started", label: "Getting Started" },
      { slug: "sdk/nodejs/authentication", label: "Authentication" },
      { slug: "sdk/nodejs/monitor-service", label: "Monitor Service" },
      { slug: "sdk/nodejs/status-page-service", label: "Status Page Service" },
      {
        slug: "sdk/nodejs/status-report-service",
        label: "Status Report Service",
      },
      {
        slug: "sdk/nodejs/maintenance-service",
        label: "Maintenance Service",
      },
      {
        slug: "sdk/nodejs/notification-service",
        label: "Notification Service",
      },
      { slug: "sdk/nodejs/health-service", label: "Health Service" },
      { slug: "sdk/nodejs/error-handling", label: "Error Handling" },
      { slug: "sdk/nodejs/typescript-tips", label: "TypeScript Tips" },
      { slug: "sdk/nodejs/reference", label: "Reference" },
    ],
  },
  {
    label: "Reference",
    collapsed: true,
    items: [
      {
        link: "https://api.openstatus.dev/v1",
        label: "API Reference V1 - Deprecated",
        external: true,
      },
      {
        link: "https://api.openstatus.dev/openapi",
        label: "API Reference V2",
        external: true,
      },
      { slug: "reference/cli-reference", label: "CLI Reference" },
      { slug: "reference/mcp-server", label: "MCP Server" },
      { slug: "reference/dns-monitor", label: "DNS Monitor" },
      { slug: "reference/http-monitor", label: "HTTP Monitor" },
      { slug: "reference/incident", label: "Incident" },
      { slug: "reference/tcp-monitor", label: "TCP Monitor" },
      { slug: "reference/notification", label: "Notification" },
      { slug: "reference/location", label: "Location" },
      { slug: "reference/private-location", label: "Private location" },
      { slug: "reference/status-page", label: "Status Page" },
      { slug: "reference/page-components", label: "Page Components" },
      { slug: "reference/status-report", label: "Status Report" },
      { slug: "reference/maintenance", label: "Maintenance" },
      { slug: "reference/subscriber", label: "Subscriber" },
      { slug: "reference/terraform", label: "Terraform Provider" },
    ],
  },
  {
    label: "Help",
    collapsed: true,
    items: [{ slug: "help/support", label: "Need help?" }],
  },
];

export function isExternalItem(
  item: DocsNavItem,
): item is { link: string; label: string; external: true } {
  return "external" in item && item.external;
}

// Flattened, in-order list of internal doc slugs — drives prev/next navigation
// and the build-time validation against the content directory.
export function flattenDocsNav(): { slug: string; label: string }[] {
  return docsNav.flatMap((section) =>
    section.items.filter((i) => !isExternalItem(i)),
  ) as { slug: string; label: string }[];
}

// The URL segment that represents a whole section, e.g. Concepts → /docs/concept.
// Each section's items share a unique first path segment.
export function sectionParentSlug(section: DocsNavSection): string | undefined {
  const item = section.items.find((i) => !isExternalItem(i));
  return item && !isExternalItem(item) ? item.slug.split("/")[0] : undefined;
}

export function sectionForParentSlug(
  parentSlug: string,
): DocsNavSection | undefined {
  return docsNav.find((s) => sectionParentSlug(s) === parentSlug);
}

// Parent/section landing slugs (concept, tutorial, …) for static generation.
export function getParentSlugs(): string[] {
  return docsNav.map(sectionParentSlug).filter((s): s is string => Boolean(s));
}

// Map a slug back to its section label (the value a doc's `category` must hold).
export function sectionForSlug(slug: string): DocsSection | undefined {
  for (const section of docsNav) {
    if (
      section.items.some(
        (i) => !isExternalItem(i) && "slug" in i && i.slug === slug,
      )
    ) {
      return section.label as DocsSection;
    }
  }
  return undefined;
}
