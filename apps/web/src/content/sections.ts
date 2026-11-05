// One record per listing route. `label` is the h1 / breadcrumb / markdown
// heading, `title` the <title> and og card; HTML and markdown read both.
export type ContentSection = {
  label: string;
  path: string;
  title: string;
  description: string;
  // Listed under /{path}/category/{slug}; falls back to `description`.
  categoryDescription?: string;
};

export const sections = {
  blog: {
    label: "Blog",
    path: "/blog",
    title: "Blog - Engineering, Product & Monitoring Insights",
    description:
      "Read engineering deep dives, product updates, and monitoring best practices from the openstatus team. Learn about uptime monitoring, incident communication, and building reliable systems.",
    categoryDescription: "All the latest articles and news from openstatus.",
  },
  changelog: {
    label: "Changelog",
    path: "/changelog",
    title: "Changelog",
    description: "All the latest changes and updates to openstatus.",
  },
  compare: {
    label: "Comparisons",
    path: "/compare",
    title: "Compare openstatus with uptime and status page solutions",
    description:
      "See how openstatus compares to BetterStack, UptimeRobot, Checkly, Instatus, and other monitoring tools. Side-by-side feature and pricing comparisons to help you choose the right solution.",
  },
  guides: {
    label: "Guides",
    path: "/guides",
    title: "Guides",
    description: "All the latest guides from openstatus.",
  },
  "use-case": {
    label: "Use Cases",
    path: "/use-case",
    title: "Use Cases",
    description:
      "Discover how teams use openstatus for compliance, incident records for audits, reducing support tickets, closing enterprise deals, open-source projects, crypto exchanges, and API infrastructure.",
  },
  customers: {
    label: "Customers",
    path: "/customers",
    title: "Meet our customers",
    description:
      "Real teams using openstatus to monitor uptime, latency, and run their status pages.",
  },
  tooling: {
    label: "Tooling",
    path: "/tooling",
    title: "Manage openstatus from anywhere",
    description:
      "Manage status pages and uptime monitoring from anywhere your workflow lives — CLI, ConnectRPC API, Node SDK, Terraform provider, and MCP server, all on a single API key.",
  },
  play: {
    label: "Playground (Tools)",
    path: "/play",
    title: "Playground (Tools)",
    description: "Playground for tools and services related to openstatus.",
  },
  status: {
    label: "External Status",
    path: "/status",
    title: "External Status",
    description:
      "Check whether the external providers you depend on are working properly.",
  },
  "oss-friends": {
    label: "OSS Friends",
    path: "/oss-friends",
    title: "OSS Friends",
    description: "List of all our awesome open source friends.",
  },
} satisfies Record<string, ContentSection>;

export type SectionKey = keyof typeof sections;

export function capitalize(slug: string) {
  return `${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
}

/** Metadata for /{section}/category/{slug}. */
export function categorySection(section: ContentSection, slug: string) {
  return {
    label: capitalize(slug),
    path: `${section.path}/category/${encodeURIComponent(slug)}`,
    title: `${section.label} - ${capitalize(slug)}`,
    description: section.categoryDescription ?? section.description,
  };
}

/** Metadata for the /{section}/category index. */
export function categoriesIndex(section: ContentSection) {
  return {
    label: `${section.label} Categories`,
    path: `${section.path}/category`,
    title: `${section.label} Categories`,
    description: `Browse all ${section.label.toLowerCase()} categories from openstatus.`,
  };
}
