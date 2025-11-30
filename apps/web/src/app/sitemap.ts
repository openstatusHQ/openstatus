import {
  getBlogPosts,
  getChangelogPosts,
  getComparePages,
  getProductPages,
  getToolsPages,
  getUnrelatedPages,
} from "@/content/utils";
import type { MetadataRoute } from "next";

const allPosts = getBlogPosts();
const allChangelogs = getChangelogPosts();
const allComparisons = getComparePages();
const allUnrelated = getUnrelatedPages().filter(
  (page) => page.slug !== "not-found",
);
const allProducts = getProductPages();
const allPlaygrounds = getToolsPages().filter(
  (tool) => tool.slug !== "checker-slug",
);

export default function sitemap(): MetadataRoute.Sitemap {
  const blogs = allPosts.map((post) => ({
    url: `https://www.openstatus.dev/blog/${post.slug}`,
    lastModified: post.metadata.publishedAt, // date format should be YYYY-MM-DD
  }));

  const changelogs = allChangelogs.map((post) => ({
    url: `https://www.openstatus.dev/changelog/${post.slug}`,
    lastModified: post.metadata.publishedAt, // date format should be YYYY-MM-DD
  }));

  const comparisons = allComparisons.map((comparison) => ({
    url: `https://www.openstatus.dev/compare/${comparison.slug}`,
    lastModified: comparison.metadata.publishedAt,
  }));

  const landings = allUnrelated.map((page) => ({
    url: `https://www.openstatus.dev/${page.slug}`,
    lastModified: page.metadata.publishedAt,
  }));

  const products = allProducts.map((product) => ({
    url: `https://www.openstatus.dev/${product.slug}`,
    lastModified: product.metadata.publishedAt,
  }));

  const playgrounds = allPlaygrounds.map((playground) => ({
    url: `https://www.openstatus.dev/play/${playground.slug}`,
    lastModified: playground.metadata.publishedAt,
  }));

  return [
    ...blogs,
    ...changelogs,
    ...comparisons,
    ...landings,
    ...products,
    ...playgrounds,
  ];
}
