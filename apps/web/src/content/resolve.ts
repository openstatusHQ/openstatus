import { generateListingForPath } from "./listing";
import type { MDXData } from "./utils";
import {
  getBlogPosts,
  getChangelogPosts,
  getComparePages,
  getGuides,
  getHomePage,
  getProductPages,
  getToolsPages,
  getUnrelatedPages,
} from "./utils";

/**
 * Content resolution result - either MDX content or a generated listing
 */
export type ContentResult =
  | { type: "mdx"; data: MDXData }
  | { type: "listing"; data: string };

/**
 * Resolves pathname to content using two-tier fallback:
 * 1. Try to find MDX content (blog posts, pages, etc.)
 * 2. Fallback to generating sitemap-style listings
 */
export function resolveContent(pathname: string): ContentResult | null {
  // Normalize pathname: remove trailing slash, decode URI
  const normalizedPath = decodeURIComponent(pathname).replace(/\/$/, "");

  // TIER 1: Try to find MDX content first
  const mdxContent = resolveMdxContent(normalizedPath);
  if (mdxContent) {
    return { type: "mdx", data: mdxContent };
  }

  // TIER 2: Fallback to listing generation
  const listing = generateListingForPath(normalizedPath);
  if (listing) {
    return { type: "listing", data: listing };
  }

  // Not found
  return null;
}

/**
 * Resolves pathname to MDX content
 */
function resolveMdxContent(pathname: string): MDXData | null {
  const segments = pathname.split("/").filter(Boolean);

  // Root path → home.mdx (confirmed: file exists)
  if (segments.length === 0) {
    try {
      return getHomePage();
    } catch {
      // home.mdx doesn't exist, will fallback to listing
      return null;
    }
  }

  // Prefixed paths (category/slug format)
  const [category, slug] = segments;

  // Skip /blog/category/slug pattern (handled by listing generator)
  if (slug && slug !== "category") {
    switch (category) {
      case "blog":
        return getBlogPosts().find((p) => p.slug === slug) ?? null;
      case "changelog":
        return getChangelogPosts().find((p) => p.slug === slug) ?? null;
      case "compare":
        return getComparePages().find((p) => p.slug === slug) ?? null;
      case "guides":
        return getGuides().find((p) => p.slug === slug) ?? null;
      case "play":
        return getToolsPages().find((p) => p.slug === slug) ?? null;
      default:
        return null;
    }
  }

  // Single segment: try unrelated, then product
  if (segments.length === 1) {
    const singleSlug = segments[0];
    return (
      getUnrelatedPages().find((p) => p.slug === singleSlug) ??
      getProductPages().find((p) => p.slug === singleSlug) ??
      null
    );
  }

  return null;
}
