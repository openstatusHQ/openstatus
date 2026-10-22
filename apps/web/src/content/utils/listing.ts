import { getDocsPage } from "../docs";
import { docsNavTree, findDocsNode } from "../docs.config";
import { canonicalUrl, frontmatter } from "../frontmatter";
import { playTools } from "../play-tools";
import {
  type ContentSection,
  categoriesIndex,
  categorySection,
  sections,
} from "../sections";
import {
  type MDXData,
  formatDate,
  getBlogPosts,
  getChangelogPosts,
  getComparePages,
  getCustomerPages,
  getGuides,
  getToolingPages,
  getUseCasePages,
} from "./index";

// Sections backed by a directory of MDX posts, in root-listing order.
const postSections: { section: ContentSection; posts: () => MDXData[] }[] = [
  { section: sections.blog, posts: getBlogPosts },
  { section: sections.changelog, posts: getChangelogPosts },
  { section: sections.compare, posts: getComparePages },
  { section: sections.guides, posts: getGuides },
  { section: sections["use-case"], posts: getUseCasePages },
  { section: sections.customers, posts: getCustomerPages },
  { section: sections.tooling, posts: getToolingPages },
];

function findPostSection(category: string) {
  return postSections.find((s) => s.section.path === `/${category}`);
}

/**
 * Generates sitemap-style markdown listings for index and category pages
 * Used as fallback when MDX content is not found
 */
export function generateListingForPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);

  // Root path → overview of all content
  if (segments.length === 0) {
    return generateRootListing();
  }

  // Docs containers (hub, sections) have no backing MDX file — they render as
  // card grids; list their children from the nav tree. Leaves hit TIER 1.
  if (segments[0] === "docs") {
    return generateDocsListing(`/${segments.join("/")}`);
  }

  const [category, subcategory, slug] = segments;

  // Index pages: /blog, /changelog, etc.
  if (!subcategory) {
    if (category === "play") return generatePlayListing();
    const match = findPostSection(category);
    return match ? generatePostsList(match.posts(), match.section) : null;
  }

  // Category index: /blog/category
  if (subcategory === "category" && !slug) {
    return generateCategoriesIndex(category);
  }

  // Category pages: /blog/category/engineering
  if (subcategory === "category" && slug) {
    return generateCategoryList(category, slug);
  }

  return null;
}

/**
 * Generate a markdown list from posts
 */
type ListingMeta = Pick<
  ContentSection,
  "label" | "path" | "title" | "description"
>;

function generatePostsList(posts: MDXData[], meta: ListingMeta): string {
  const sorted = posts.sort(
    (a, b) =>
      b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime(),
  );

  const items = sorted
    .map(
      (post) =>
        `- [${post.metadata.title}](${post.href}) - ${formatDate(post.metadata.publishedAt)}`,
    )
    .join("\n");

  return `${listingHeader(meta)}${items}\n`;
}

// Same frontmatter + h1 + intro for every listing; the HTML page shows the
// label as h1 and the title in <title>, so markdown does the same.
function listingHeader(meta: ListingMeta): string {
  const fm = frontmatter({
    title: meta.title,
    url: canonicalUrl(meta.path),
    description: meta.description,
  });
  return `${fm}# ${meta.label}\n\n${meta.description}\n\n`;
}

/**
 * Generate category-filtered listings
 */
function generateCategoryList(type: string, category: string): string | null {
  const match = findPostSection(type);
  if (!match) return null;

  const filtered = match
    .posts()
    .filter(
      (p) => p.metadata.category.toLowerCase() === category.toLowerCase(),
    );
  if (filtered.length === 0) return null;

  return generatePostsList(filtered, categorySection(match.section, category));
}

function generateCategoriesIndex(type: string): string | null {
  const match = findPostSection(type);
  if (!match) return null;

  const categories = [
    ...new Set(match.posts().map((p) => p.metadata.category)),
  ];
  const items = categories
    .map((c) => `- [${c}](${match.section.path}/category/${c.toLowerCase()})`)
    .join("\n");

  return `${listingHeader(categoriesIndex(match.section))}${items}\n`;
}

/**
 * Generate root listing with overview of all content sections
 */
function generateRootListing(): string {
  const content = postSections
    .map(({ section, posts }) => {
      const sorted = posts().sort(
        (a, b) =>
          b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime(),
      );
      const count = sorted.length;

      const topPosts = sorted
        .slice(0, 5)
        .map((p) => `- [${p.metadata.title}](${p.href})`)
        .join("\n");

      const viewAll =
        count > 5
          ? `\n- [View all ${count} ${section.label.toLowerCase()}...](${section.path})`
          : "";

      return `## [${section.label}](${section.path}) (${count})\n\n${topPosts}${viewAll}`;
    })
    .join("\n\n");

  return `${listingHeader({
    label: "openstatus content",
    path: "/",
    title: "openstatus content",
    description:
      "Everything published on openstatus.dev: blog posts, changelog, comparisons, guides, use cases, customer stories and tooling.",
  })}${content}\n`;
}

function generatePlayListing(): string {
  const items = playTools
    .map((tool) => `- [${tool.label}](${tool.href}): ${tool.description}`)
    .join("\n");
  return `${listingHeader(sections.play)}${items}\n`;
}

// List a docs container node's children. Any node in the tree with children is
// listable (hub lists sections, a section lists pages); leaves return null and
// fall through to their MDX file. Descriptions are resolved lazily per child.
function generateDocsListing(href: string): string | null {
  const node = findDocsNode(docsNavTree(), href);
  if (!node?.children?.length) return null;

  // Sections have no copy of their own; the hub lists them by their first
  // page's description, so a section describes itself the same way.
  const description =
    node.description ??
    (node.slug ? getDocsPage(node.slug)?.metadata.description : undefined);
  const intro = description ? `${description}\n\n` : "";
  const items = node.children
    .map((child) => {
      const description = child.slug
        ? getDocsPage(child.slug)?.metadata.description
        : undefined;
      return `- [${child.label}](${child.href})${description ? `: ${description}` : ""}`;
    })
    .join("\n");

  return `${frontmatter({ title: node.label, url: canonicalUrl(href), description })}# ${node.label}\n\n${intro}${items}\n`;
}
