import path from "node:path";

import { getDocs } from "../docs";
import { type MDXData, getMDXDataFromDir, getMDXDataFromFile } from "./read";

export * from "./schema";
export type { MDXData } from "./read";

export function getBlogPosts(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "blog"),
    "/blog",
  );
}

export function getChangelogPosts(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "changelog"),
    "/changelog",
  );
}

export function getProductPages(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "product"),
    "",
  );
}

export function getGuides(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "guides"),
    "/guides",
  );
}

export function getUseCasePages(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "use-case"),
    "/use-case",
  );
}

export function getUnrelatedPages(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "unrelated"),
    "",
  );
}

export function getUnrelatedPage(slug: string): MDXData {
  return getMDXDataFromFile(
    path.join(
      process.cwd(),
      "src",
      "content",
      "pages",
      "unrelated",
      `${slug}.mdx`,
    ),
    "",
  );
}

export function getMainPages(): MDXData[] {
  return [...getUnrelatedPages(), ...getProductPages()];
}

export function getComparePages(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "compare"),
    "/compare",
  );
}

export function getHomePage(): MDXData {
  return getMDXDataFromFile(
    path.join(process.cwd(), "src", "content", "pages", "home.mdx"),
    "",
  );
}

// `*-slug.mdx` files back dynamic routes (e.g. /play/checker/[slug],
// /play/mcp-health/[id]) and aren't standalone pages — exclude them from
// listings, sitemaps, and search. Use `getToolsPage("foo-slug")` to fetch one.
export function getToolsPages(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "tools"),
    "/play",
  ).filter((page) => !page.slug.endsWith("-slug"));
}

export function getToolsPage(slug: string): MDXData {
  return getMDXDataFromFile(
    path.join(process.cwd(), "src", "content", "pages", "tools", `${slug}.mdx`),
    "/play",
  );
}

export function getToolingPages(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "product", "tooling"),
    "/tooling",
  );
}

export function getToolingPage(slug: string): MDXData {
  return getMDXDataFromFile(
    path.join(
      process.cwd(),
      "src",
      "content",
      "pages",
      "product",
      "tooling",
      `${slug}.mdx`,
    ),
    "/tooling",
  );
}

export function getCustomerPages(): MDXData[] {
  return getMDXDataFromDir(
    path.join(process.cwd(), "src", "content", "pages", "customers"),
    "/customers",
  );
}

export function getCustomerPage(slug: string): MDXData {
  return getMDXDataFromFile(
    path.join(
      process.cwd(),
      "src",
      "content",
      "pages",
      "customers",
      `${slug}.mdx`,
    ),
    "/customers",
  );
}

export function getDocPages(): MDXData[] {
  return getDocs();
}

export const PAGE_TYPES = [
  "blog",
  "changelog",
  "product",
  "unrelated",
  "compare",
  "tools",
  "tooling",
  "customers",
  "guides",
  "use-case",
  "docs",
  "all",
] as const;

export type PageType = (typeof PAGE_TYPES)[number];

export function getPages(type: PageType) {
  switch (type) {
    case "blog":
      return getBlogPosts();
    case "changelog":
      return getChangelogPosts();
    case "product":
      return getProductPages();
    case "unrelated":
      return getUnrelatedPages();
    case "compare":
      return getComparePages();
    case "tools":
      return getToolsPages();
    case "tooling":
      return getToolingPages();
    case "customers":
      return getCustomerPages();
    case "guides":
      return getGuides();
    case "use-case":
      return getUseCasePages();
    case "docs":
      return getDocPages();
    case "all":
      return [
        ...getBlogPosts(),
        ...getChangelogPosts(),
        ...getProductPages(),
        ...getUnrelatedPages(),
        ...getComparePages(),
        ...getToolsPages(),
        ...getToolingPages(),
        ...getCustomerPages(),
        ...getGuides(),
        ...getUseCasePages(),
      ];
    default:
      throw new Error(`Unknown page type: ${type}`);
  }
}

export function getCategories() {
  return [
    ...new Set([
      ...getBlogPosts().map((post) => post.metadata.category),
      ...getChangelogPosts().map((post) => post.metadata.category),
      ...getProductPages().map((post) => post.metadata.category),
      ...getUnrelatedPages().map((post) => post.metadata.category),
      ...getComparePages().map((post) => post.metadata.category),
      ...getToolsPages().map((post) => post.metadata.category),
      ...getToolingPages().map((post) => post.metadata.category),
      ...getCustomerPages().map((post) => post.metadata.category),
    ]),
  ] as const;
}

export function formatDate(targetDate: Date, includeRelative = false) {
  const currentDate = new Date();

  const yearsAgo = currentDate.getFullYear() - targetDate.getFullYear();
  const monthsAgo = currentDate.getMonth() - targetDate.getMonth();
  const daysAgo = currentDate.getDate() - targetDate.getDate();

  let formattedDate = "";

  if (yearsAgo > 0) {
    formattedDate = `${yearsAgo}y ago`;
  } else if (monthsAgo > 0) {
    formattedDate = `${monthsAgo}mo ago`;
  } else if (daysAgo > 0) {
    formattedDate = `${daysAgo}d ago`;
  } else {
    formattedDate = "Today";
  }

  const fullDate = targetDate.toLocaleString("en-us", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });

  if (!includeRelative) {
    return fullDate;
  }

  return `${fullDate} (${formattedDate})`;
}
