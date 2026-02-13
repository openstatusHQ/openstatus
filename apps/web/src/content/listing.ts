import {
  type MDXData,
  formatDate,
  getBlogPosts,
  getChangelogPosts,
  getComparePages,
  getGuides,
} from "./utils";

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

  const [category, subcategory, slug] = segments;

  // Index pages: /blog, /changelog, etc.
  if (!subcategory) {
    switch (category) {
      case "blog":
        return generatePostsList(getBlogPosts(), "Blog Posts");
      case "changelog":
        return generatePostsList(getChangelogPosts(), "Changelog");
      case "compare":
        return generatePostsList(getComparePages(), "Comparisons");
      case "guides":
        return generatePostsList(getGuides(), "Guides");
      default:
        return null;
    }
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
function generatePostsList(posts: MDXData[], title: string): string {
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

  return `# ${title}\n\n${items}\n`;
}

/**
 * Generate category-filtered listings
 */
function generateCategoryList(type: string, category: string): string | null {
  let posts: MDXData[];
  let title: string;

  switch (type) {
    case "blog":
      posts = getBlogPosts();
      title = `Blog Posts - ${category}`;
      break;
    case "changelog":
      posts = getChangelogPosts();
      title = `Changelog - ${category}`;
      break;
    default:
      return null;
  }

  const filtered = posts.filter((p) => p.metadata.category === category);

  if (filtered.length === 0) {
    return null;
  }

  return generatePostsList(filtered, title);
}

/**
 * Generate root listing with overview of all content sections
 */
function generateRootListing(): string {
  const sections = [
    { title: "Blog", posts: getBlogPosts(), path: "/blog" },
    { title: "Changelog", posts: getChangelogPosts(), path: "/changelog" },
    { title: "Comparisons", posts: getComparePages(), path: "/compare" },
    { title: "Guides", posts: getGuides(), path: "/guides" },
  ];

  const content = sections
    .map((section) => {
      const count = section.posts.length;
      const sortedPosts = section.posts.sort(
        (a, b) =>
          b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime(),
      );

      const topPosts = sortedPosts
        .slice(0, 5)
        .map((p) => `- [${p.metadata.title}](${p.href})`)
        .join("\n");

      const viewAll =
        count > 5
          ? `\n- [View all ${count} ${section.title.toLowerCase()}...](${section.path})`
          : "";

      return `## [${section.title}](${section.path}) (${count})\n\n${topPosts}${viewAll}`;
    })
    .join("\n\n");

  return `# OpenStatus Content\n\n${content}\n`;
}
