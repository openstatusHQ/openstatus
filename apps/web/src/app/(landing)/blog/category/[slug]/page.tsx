import type { Metadata } from "next";

import { categorySection, sections } from "../../../../../content/sections";
import { getBlogPosts } from "../../../../../content/utils";
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
  return getListingMetadata(categorySection(sections.blog, slug));
}

export const dynamicParams = false;

export async function generateStaticParams() {
  const posts = getBlogPosts();
  const categories = [...new Set(posts.map((post) => post.metadata.category))];

  return categories.map((category) => ({
    slug: category.toLowerCase(),
  }));
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const allBlogs = getBlogPosts();
  const filteredBlogs = allBlogs.filter(
    (post) => post.metadata.category.toLowerCase() === slug.toLowerCase(),
  );

  const category = categorySection(sections.blog, slug);
  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDSectionBreadcrumb(sections.blog, category),
    getJsonLDItemList(filteredBlogs, "/blog"),
  ]);

  return (
    <div className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1 className="capitalize">{category.label}</h1>
      <ContentCategory data={allBlogs} prefix="/blog" />
      <ContentList data={filteredBlogs} prefix="/blog" />
    </div>
  );
}
