import {
  getBlogPosts,
  getChangelogPosts,
  getComparePages,
  getGuides,
  getHomePage,
  getProductPages,
  getToolingPages,
  getToolsPages,
  getUnrelatedPages,
  getUseCasePages,
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
const allGuides = getGuides();
const allUseCases = getUseCasePages();
const allTooling = getToolingPages();

export default function sitemap(): MetadataRoute.Sitemap {
  const blogs = allPosts.map((post) => ({
    url: `https://www.openstatus.dev/blog/${post.slug}`,
    lastModified: post.metadata.publishedAt, // date format should be YYYY-MM-DD
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const blogIndex = [
    {
      url: "https://www.openstatus.dev/blog",
      lastModified: new Date().toISOString().slice(0, 10),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    },
  ];

  const changelogs = allChangelogs.map((post) => ({
    url: `https://www.openstatus.dev/changelog/${post.slug}`,
    lastModified: post.metadata.publishedAt, // date format should be YYYY-MM-DD
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  const changelogIndex = [
    {
      url: "https://www.openstatus.dev/changelog",
      lastModified: new Date().toISOString().slice(0, 10),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    },
  ];

  const comparisons = allComparisons.map((comparison) => ({
    url: `https://www.openstatus.dev/compare/${comparison.slug}`,
    lastModified: comparison.metadata.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const comparisonIndex = [
    {
      url: "https://www.openstatus.dev/compare",
      lastModified: new Date().toISOString().slice(0, 10),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
  ];

  const landings = allUnrelated.map((page) => ({
    url: `https://www.openstatus.dev/${page.slug}`,
    lastModified: page.metadata.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const products = allProducts.map((product) => ({
    url: `https://www.openstatus.dev/${product.slug}`,
    lastModified: product.metadata.publishedAt,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const playgrounds = allPlaygrounds.map((playground) => ({
    url: `https://www.openstatus.dev/play/${playground.slug}`,
    lastModified: playground.metadata.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const playgroundIndex = [
    {
      url: "https://www.openstatus.dev/play",
      lastModified: new Date().toISOString().slice(0, 10),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
  ];

  const guides = allGuides.map((guide) => ({
    url: `https://www.openstatus.dev/guides/${guide.slug}`,
    lastModified: guide.metadata.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const guideIndex = [
    {
      url: "https://www.openstatus.dev/guides",
      lastModified: new Date().toISOString().slice(0, 10),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    },
  ];

  const home = [
    {
      url: "https://www.openstatus.dev/",
      lastModified: getHomePage().metadata.publishedAt,
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
  ];

  const useCases = allUseCases.map((useCase) => ({
    url: `https://www.openstatus.dev/use-case/${useCase.slug}`,
    lastModified: useCase.metadata.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const useCaseIndex = [
    {
      url: "https://www.openstatus.dev/use-case",
      lastModified: new Date().toISOString().slice(0, 10),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
  ];

  const toolingIndex = [
    {
      url: "https://www.openstatus.dev/tooling",
      lastModified: new Date().toISOString().slice(0, 10),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
  ];

  const toolings = allTooling.map((page) => ({
    url: `https://www.openstatus.dev/tooling/${page.slug}`,
    lastModified: page.metadata.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [
    ...home,
    ...blogs,
    ...blogIndex,
    ...changelogs,
    ...changelogIndex,
    ...comparisons,
    ...comparisonIndex,
    ...landings,
    ...products,
    ...playgrounds,
    ...playgroundIndex,
    ...guides,
    ...guideIndex,
    ...useCases,
    ...useCaseIndex,
    ...toolings,
    ...toolingIndex,
  ];
}
