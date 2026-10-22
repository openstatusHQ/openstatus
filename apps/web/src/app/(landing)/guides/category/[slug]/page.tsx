import type { Metadata } from "next";

import { categorySection, sections } from "../../../../../content/sections";
import { getGuides } from "../../../../../content/utils";
import { JsonLd } from "../../../../../lib/metadata/json-ld";
import { getListingMetadata } from "../../../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDItemList,
  getJsonLDOrganization,
  getJsonLDSectionBreadcrumb,
} from "../../../../../lib/metadata/structured-data";
import { ContentCategory } from "../../../content-category";
import { ContentList } from "../../../content-list";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return getListingMetadata(categorySection(sections.guides, slug));
}

export const dynamicParams = false;

export async function generateStaticParams() {
  const posts = getGuides();
  const categories = [...new Set(posts.map((post) => post.metadata.category))];

  return categories.map((category) => ({
    slug: category.toLowerCase(),
  }));
}

export default async function GuideCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const allGuides = getGuides();
  const filteredGuides = allGuides.filter(
    (post) => post.metadata.category.toLowerCase() === slug.toLowerCase(),
  );

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDSectionBreadcrumb(
      sections.guides,
      categorySection(sections.guides, slug),
    ),
    getJsonLDItemList(filteredGuides, "/guides"),
  ]);

  return (
    <div className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1 className="capitalize">Guides | {slug}</h1>
      <ContentCategory data={allGuides} prefix="/guides" />
      <ContentList data={filteredGuides} prefix="/guides" />
    </div>
  );
}
