import type { MetadataRoute } from "next";

import {
  getBlogPosts,
  getChangelogPosts,
  getComparePages,
  getCustomerPages,
  getDocPages,
  getGuides,
  getHomePage,
  getProductPages,
  getToolingPages,
  getToolsPages,
  getUnrelatedPages,
  getUseCasePages,
  isIndexable,
} from "../content/utils";
import type { Metadata } from "../content/utils/schema";
import {
  cachedListExternalComponentsBySlug,
  cachedListExternalServices,
} from "../lib/external-service-cache";

export const revalidate = 3600;

const modified = (m: Metadata) => m.updatedAt ?? m.publishedAt;

const allPosts = getBlogPosts().filter(isIndexable);
const allChangelogs = getChangelogPosts().filter(isIndexable);
const allComparisons = getComparePages().filter(isIndexable);
const allUnrelated = getUnrelatedPages().filter(isIndexable);
const allProducts = getProductPages().filter(isIndexable);
const allPlaygrounds = getToolsPages().filter(isIndexable);
const allGuides = getGuides().filter(isIndexable);
const allUseCases = getUseCasePages().filter(isIndexable);
const allTooling = getToolingPages().filter(isIndexable);
const allCustomers = getCustomerPages().filter(isIndexable);
const allDocs = getDocPages().filter(isIndexable);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const externalServices = await cachedListExternalServices();
  const externalServiceEntries: MetadataRoute.Sitemap = externalServices
    .filter((s) => s.deletedAt == null)
    .map((s) => ({
      url: `https://www.openstatus.dev/status/${s.slug}`,
      lastModified: new Date().toISOString().slice(0, 10),
      changeFrequency: "hourly" as const,
      priority: 0.7,
    }));

  const externalServicesIndex: MetadataRoute.Sitemap = [
    {
      url: "https://www.openstatus.dev/status",
      lastModified: new Date().toISOString().slice(0, 10),
      changeFrequency: "hourly" as const,
      priority: 0.8,
    },
  ];

  const componentEntriesByService = await Promise.all(
    externalServices
      .filter((s) => s.deletedAt == null)
      .map(async (s) => {
        const { components } = await cachedListExternalComponentsBySlug(s.slug);
        return components.map((c) => ({
          url: `https://www.openstatus.dev/status/${s.slug}/${c.slug}`,
          lastModified: new Date().toISOString().slice(0, 10),
          changeFrequency: "hourly" as const,
          priority: 0.6,
        }));
      }),
  );
  const externalServiceComponentEntries: MetadataRoute.Sitemap =
    componentEntriesByService.flat();

  const blogs = allPosts.map((post) => ({
    url: `https://www.openstatus.dev/blog/${post.slug}`,
    lastModified: modified(post.metadata),
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
    lastModified: modified(post.metadata),
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
    lastModified: modified(comparison.metadata),
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
    lastModified: modified(page.metadata),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const products = allProducts.map((product) => ({
    url: `https://www.openstatus.dev/${product.slug}`,
    lastModified: modified(product.metadata),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const playgrounds = allPlaygrounds.map((playground) => ({
    url: `https://www.openstatus.dev/play/${playground.slug}`,
    lastModified: modified(playground.metadata),
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
    lastModified: modified(guide.metadata),
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
      lastModified: modified(getHomePage().metadata),
      changeFrequency: "daily" as const,
      priority: 1.0,
    },
  ];

  const useCases = allUseCases.map((useCase) => ({
    url: `https://www.openstatus.dev/use-case/${useCase.slug}`,
    lastModified: modified(useCase.metadata),
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
    lastModified: modified(page.metadata),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const customersIndex = [
    {
      url: "https://www.openstatus.dev/customers",
      lastModified: new Date().toISOString().slice(0, 10),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
  ];

  const customers = allCustomers.map((page) => ({
    url: `https://www.openstatus.dev/customers/${page.slug}`,
    lastModified: modified(page.metadata),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const docs = allDocs.map((page) => ({
    url: `https://www.openstatus.dev/docs/${page.slug}`,
    lastModified: modified(page.metadata),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const docsIndex = [
    {
      url: "https://www.openstatus.dev/docs",
      lastModified: new Date().toISOString().slice(0, 10),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
  ];

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
    ...customers,
    ...customersIndex,
    ...docs,
    ...docsIndex,
    ...externalServicesIndex,
    ...externalServiceEntries,
    ...externalServiceComponentEntries,
  ];
}
