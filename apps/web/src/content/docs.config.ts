// Single source of truth for docs section order, page order, and sidebar labels.
// Labels mirror each page's `title`, except section-landing pages which keep a
// short label (e.g. title "Foundational Concepts" → label "Overview"). Page→section
// membership is mirrored by each doc's `category` frontmatter and cross-checked
// at build time (see `validateDocsNav`).

export type DocsNavLeaf = { slug: string; label: string };
export type DocsNavExternal = { link: string; label: string; external: true };
// A chapter: a collapsible group of items, nestable to any depth. Has no slug of
// its own — its landing page (if any) is just the first child, by convention an
// "Overview" leaf — mirroring how a top-level section is rendered.
export type DocsNavGroup = {
  label: string;
  collapsed?: boolean;
  items: DocsNavItem[];
};
export type DocsNavItem = DocsNavLeaf | DocsNavExternal | DocsNavGroup;

export type DocsNavSection = DocsNavGroup;

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
      {
        slug: "concept/uptime-monitoring",
        label: "Understanding Uptime Monitoring",
      },
      {
        slug: "concept/probes-and-locations",
        label: "Probes, Locations, and Regions",
      },
      {
        slug: "concept/private-locations",
        label: "Understanding Private Locations",
      },
      {
        slug: "concept/status-reports-and-incidents",
        label: "Understanding Status Reports and Incidents",
      },
      {
        slug: "concept/best-practices-status-page",
        label: "Building Trust with Status Pages",
      },
      {
        slug: "concept/uptime-calculation-and-values",
        label: "Uptime Calculation and Shared Values",
      },
      {
        slug: "concept/uptime-monitoring-as-code",
        label: "Understanding Monitoring as Code",
      },
      {
        slug: "concept/latency-vs-response-time",
        label: "Understanding Latency vs Response Time",
      },
    ],
  },
  {
    label: "Tutorials",
    collapsed: true,
    items: [
      { slug: "tutorial/getting-started", label: "Overview" },
      {
        slug: "tutorial/create-your-first-monitor",
        label: "Create an Uptime Monitor",
      },
      {
        slug: "tutorial/your-first-notification",
        label: "Wire Up Your First Notification",
      },
      {
        slug: "tutorial/create-your-first-status-page",
        label: "Create a Status Page",
      },
      {
        slug: "tutorial/your-first-status-report",
        label: "Publish Your First Status Report",
      },
      {
        slug: "tutorial/get-started-with-openstatus-cli",
        label: "Get Started with openstatus CLI",
      },
      {
        slug: "tutorial/manage-status-reports-cli",
        label: "Manage Status Reports from the CLI",
      },
    ],
  },
  {
    label: "Guides",
    collapsed: true,
    items: [
      { slug: "guides/getting-started", label: "Overview" },
      {
        slug: "guides/how-to-configure-status-page",
        label: "How to Configure Your Status Page",
      },
      {
        slug: "guides/how-to-create-status-page-theme",
        label: "How to Create Your Own Status Page Theme",
      },
      {
        slug: "guides/how-to-import-status-page",
        label: "How to Import a Status Page from Another Provider",
      },
      {
        slug: "guides/how-to-translate-status-page",
        label: "How to translate your status page",
      },
      {
        slug: "guides/how-to-embed-status-page-iframe",
        label: "How to Embed a Status Page in an Iframe",
      },
      {
        slug: "guides/how-to-add-svg-status-badge",
        label: "How to Add a Status Badge to a GitHub README",
      },
      {
        slug: "guides/how-to-use-react-widget",
        label: "How to Use openstatus React Widget",
      },
      {
        slug: "guides/how-to-monitor-mcp-server",
        label: "How to Monitor Your Model Context Provider (MCP) Server",
      },
      {
        slug: "guides/how-to-run-synthetic-test-github-action",
        label: "How to Run Synthetic Tests in GitHub Actions",
      },
      {
        slug: "guides/how-to-export-metrics-to-otlp-endpoint",
        label: "How to Export Metrics to an OTLP Endpoint",
      },
      {
        slug: "guides/how-to-setup-slack-agent",
        label: "How to Set Up the openstatus Slack Agent",
      },
      {
        slug: "guides/how-to-deploy-statuspage-socials-notifier",
        label: "How to Auto-Post Status Updates to X and Bluesky",
      },
      {
        slug: "guides/how-to-connect-openstatus-to-claude-code",
        label: "How to Connect openstatus to Claude Code",
      },
      {
        slug: "guides/how-to-manage-openstatus-with-terraform",
        label: "How to Manage Your openstatus Stack with Terraform",
      },
      {
        slug: "guides/how-to-create-private-location",
        label: "How to Create a Private Location",
      },
      {
        slug: "guides/how-to-deploy-probes-cloudflare-containers",
        label: "How to Deploy a Private Probe on Cloudflare Containers",
      },
      {
        slug: "guides/self-hosting-openstatus",
        label: "How to Self-Host openstatus",
      },
      {
        slug: "guides/self-host-status-page-only",
        label: "Self-Host the openstatus Status Page (Lightweight)",
      },
      {
        slug: "guides/how-deploy-status-page-cf-pages",
        label: "How to Deploy a Status Page to Cloudflare Pages",
      },
    ],
  },
  {
    label: "SDK",
    collapsed: true,
    items: [
      {
        label: "Node SDK",
        collapsed: true,
        items: [
          { slug: "sdk/nodejs/overview", label: "Overview" },
          { slug: "sdk/nodejs/getting-started", label: "Getting Started" },
          { slug: "sdk/nodejs/authentication", label: "Authentication" },
          { slug: "sdk/nodejs/monitor-service", label: "Monitor Service" },
          {
            slug: "sdk/nodejs/status-page-service",
            label: "Status Page Service",
          },
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
      { slug: "sdk/php/overview", label: "PHP SDK" },
      { slug: "sdk/python/overview", label: "Python SDK" },
    ],
  },
  {
    label: "Reference",
    collapsed: true,
    items: [
      { slug: "reference/overview", label: "Overview" },
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
      { slug: "reference/dns-monitor", label: "DNS Monitor Reference" },
      { slug: "reference/http-monitor", label: "HTTP Monitor Reference" },
      { slug: "reference/incident", label: "Incident Reference" },
      { slug: "reference/tcp-monitor", label: "TCP Monitor Reference" },
      {
        slug: "reference/notification",
        label: "Notification Channels Reference",
      },
      { slug: "reference/location", label: "Location Reference" },
      {
        slug: "reference/private-location",
        label: "Private Location Reference",
      },
      { slug: "reference/status-page", label: "Status Page Reference" },
      { slug: "reference/page-components", label: "Page Components Reference" },
      { slug: "reference/status-report", label: "Status Report Reference" },
      { slug: "reference/maintenance", label: "Maintenance Reference" },
      { slug: "reference/subscriber", label: "Subscriber Reference" },
      { slug: "reference/terraform", label: "Terraform Provider Reference" },
    ],
  },
  {
    label: "Help",
    collapsed: true,
    items: [{ slug: "help/support", label: "Need help?" }],
  },
];

export function isExternalItem(item: DocsNavItem): item is DocsNavExternal {
  return "external" in item && item.external;
}

export function isGroupItem(item: DocsNavItem): item is DocsNavGroup {
  return "items" in item;
}

// First internal leaf slug in document order, descending into nested groups.
// Used to derive a section/chapter's URL parent and landing page.
export function firstLeafSlug(items: DocsNavItem[]): string | undefined {
  for (const item of items) {
    if (isExternalItem(item)) continue;
    if (isGroupItem(item)) {
      const nested = firstLeafSlug(item.items);
      if (nested) return nested;
    } else {
      return item.slug;
    }
  }
  return undefined;
}

// Flattened, in-order list of internal doc slugs — drives prev/next navigation
// and the build-time validation against the content directory. Recurses into
// nested chapters so every leaf is covered regardless of depth.
export function flattenDocsNav(): DocsNavLeaf[] {
  const walk = (items: DocsNavItem[]): DocsNavLeaf[] =>
    items.flatMap((item) => {
      if (isExternalItem(item)) return [];
      if (isGroupItem(item)) return walk(item.items);
      return [item];
    });
  return docsNav.flatMap((section) => walk(section.items));
}

// The URL segment that represents a whole section, e.g. Concepts → /docs/concept.
// Each section's items share a unique first path segment.
export function sectionParentSlug(section: DocsNavSection): string | undefined {
  return firstLeafSlug(section.items)?.split("/")[0];
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

// A navigable node in the docs hierarchy (hub → sections → pages). `slug` is set
// for internal docs/sections so descriptions can be resolved lazily; `description`
// holds a node's own intro text (only the hub has one). Pure — no fs.
export type DocsNavNode = {
  label: string;
  href: string;
  slug?: string;
  description?: string;
  children?: DocsNavNode[];
};

// The whole docs hierarchy as one rooted tree, derived from `docsNav`. Drives
// path-agnostic listing: find a node by href, list its children at any depth.
export function docsNavTree(): DocsNavNode {
  return {
    label: "openstatus documentation",
    href: "/docs",
    description:
      "Learn how to create your status page, monitor your endpoints, and configure notifications.",
    children: docsNav.map((section) => {
      const parent = sectionParentSlug(section);
      return {
        label: section.label,
        // Sections own a synthetic landing at the directory root (e.g. /docs/sdk).
        href: parent ? `/docs/${parent}` : "/docs",
        slug: firstLeafSlug(section.items),
        children: section.items.map(itemToNode),
      };
    }),
  };
}

// One nav item → one tree node. A nested chapter's landing is its directory hub
// (e.g. /docs/sdk/nodejs) — a synthetic card grid, never a backing doc — so its
// pages live one level deeper (sdk/nodejs/overview, …).
function itemToNode(item: DocsNavItem): DocsNavNode {
  if (isExternalItem(item)) return { label: item.label, href: item.link };
  if (isGroupItem(item)) {
    const hub = groupHubSlug(item);
    return {
      label: item.label,
      href: hub ? `/docs/${hub}` : "/docs",
      slug: hub,
      children: item.items.map(itemToNode),
    };
  }
  return { label: item.label, href: `/docs/${item.slug}`, slug: item.slug };
}

// Every leaf slug under a set of items, descending into nested chapters.
function leafSlugs(items: DocsNavItem[]): string[] {
  return items.flatMap((item) => {
    if (isExternalItem(item)) return [];
    if (isGroupItem(item)) return leafSlugs(item.items);
    return [item.slug];
  });
}

// A chapter's hub slug: the directory shared by all its pages. The Node SDK
// chapter (pages under sdk/nodejs/*) → "sdk/nodejs".
function groupHubSlug(group: DocsNavGroup): string | undefined {
  const dirs = leafSlugs(group.items).map((s) => s.split("/").slice(0, -1));
  if (dirs.length === 0) return undefined;
  let prefix = dirs[0];
  for (const dir of dirs.slice(1)) {
    let i = 0;
    while (i < prefix.length && prefix[i] === dir[i]) i++;
    prefix = prefix.slice(0, i);
  }
  return prefix.length ? prefix.join("/") : undefined;
}

// Slugs of every container node (sections + chapters) — the synthetic hub URLs
// that have no backing MDX file and must be statically generated as card grids.
export function getDocsContainerSlugs(): string[] {
  const out: string[] = [];
  const walk = (node: DocsNavNode) => {
    for (const child of node.children ?? []) {
      if (!child.children?.length) continue;
      const slug = child.href.replace(/^\/docs\/?/, "");
      if (slug) out.push(slug);
      walk(child);
    }
  };
  walk(docsNavTree());
  return out;
}

// Root-to-target node trail (inclusive) — the ancestor chain that drives nested
// breadcrumbs. Every intermediate node is a navigable hub (section/chapter landing).
export function findDocsTrail(
  node: DocsNavNode,
  href: string,
): DocsNavNode[] | undefined {
  if (node.href === href) return [node];
  for (const child of node.children ?? []) {
    const found = findDocsTrail(child, href);
    if (found) return [node, ...found];
  }
  return undefined;
}

// Depth-first lookup of a node by its href (e.g. "/docs", "/docs/concept").
export function findDocsNode(
  node: DocsNavNode,
  href: string,
): DocsNavNode | undefined {
  return findDocsTrail(node, href)?.at(-1);
}

// Map a slug back to its section label (the value a doc's `category` must hold).
export function sectionForSlug(slug: string): DocsSection | undefined {
  const has = (items: DocsNavItem[]): boolean =>
    items.some((i) => {
      if (isExternalItem(i)) return false;
      if (isGroupItem(i)) return has(i.items);
      return i.slug === slug;
    });
  for (const section of docsNav) {
    if (has(section.items)) return section.label as DocsSection;
  }
  return undefined;
}
