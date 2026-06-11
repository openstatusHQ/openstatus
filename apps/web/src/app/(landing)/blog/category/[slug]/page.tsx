import type { Metadata } from "next";

import { ContentCategory } from "@/app/(landing)/content-category";
import { ContentList } from "@/app/(landing)/content-list";
import { getBlogPosts } from "@/content/utils";
import { JsonLd } from "@/lib/metadata/json-ld";
import {
  BASE_URL,
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDItemList,
  getJsonLDOrganization,
} from "@/lib/metadata/structured-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const TITLE = `Blog - ${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
  const DESCRIPTION = "All the latest articles and news from openstatus.";

  return {
    ...defaultMetadata,
    title: TITLE,
    description: DESCRIPTION,
    alternates: {
      canonical: `/blog/category/${slug}`,
    },
    openGraph: {
      ...ogMetadata,
      title: TITLE,
      description: DESCRIPTION,
    },
    twitter: {
      ...twitterMetadata,
      title: TITLE,
      description: DESCRIPTION,
      images: [`/api/og?title=${TITLE}&description=${DESCRIPTION}`],
    },
  };
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

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Blog", url: `${BASE_URL}/blog` },
      {
        name: `${slug.charAt(0).toUpperCase()}${slug.slice(1)}`,
        url: `${BASE_URL}/blog/category/${slug}`,
      },
    ]),
    getJsonLDItemList(filteredBlogs, "/blog"),
  ]);

  return (
    <div className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1 className="capitalize">Blog | {slug}</h1>
      <ContentCategory data={allBlogs} prefix="/blog" />
      <ContentList data={filteredBlogs} prefix="/blog" />
    </div>
  );
}
