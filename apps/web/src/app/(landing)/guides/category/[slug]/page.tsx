import type { Metadata } from "next";

import { getGuides } from "../../../../../content/utils";
import { JsonLd } from "../../../../../lib/metadata/json-ld";
import {
  BASE_URL,
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "../../../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDItemList,
  getJsonLDOrganization,
} from "../../../../../lib/metadata/structured-data";
import { ContentCategory } from "../../../content-category";
import { ContentList } from "../../../content-list";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const TITLE = `Guides - ${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
  const DESCRIPTION = "All the latest guides from openstatus.";

  return {
    ...defaultMetadata,
    title: TITLE,
    description: DESCRIPTION,
    alternates: {
      canonical: `/guides/category/${slug}`,
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
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Guides", url: `${BASE_URL}/guides` },
      {
        name: `${slug.charAt(0).toUpperCase()}${slug.slice(1)}`,
        url: `${BASE_URL}/guides/category/${slug}`,
      },
    ]),
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
