import type { Metadata } from "next";

import { getChangelogPosts } from "../../../../../content/utils";
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
  const TITLE = `Changelog - ${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
  const DESCRIPTION = "All the latest changes and updates to openstatus.";

  return {
    ...defaultMetadata,
    title: TITLE,
    description: DESCRIPTION,
    alternates: {
      canonical: `/changelog/category/${slug}`,
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
  const posts = getChangelogPosts();
  const categories = [...new Set(posts.map((post) => post.metadata.category))];

  return categories.map((category) => ({
    slug: category.toLowerCase(),
  }));
}

export default async function ChangelogCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const allChangelogs = getChangelogPosts();
  const filteredChangelogs = allChangelogs.filter(
    (changelog) =>
      changelog.metadata.category.toLowerCase() === slug.toLowerCase(),
  );

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Changelog", url: `${BASE_URL}/changelog` },
      {
        name: `${slug.charAt(0).toUpperCase()}${slug.slice(1)}`,
        url: `${BASE_URL}/changelog/category/${slug}`,
      },
    ]),
    getJsonLDItemList(filteredChangelogs, "/changelog"),
  ]);

  return (
    <div className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
      <h1 className="capitalize">Changelog | {slug}</h1>
      <ContentCategory data={allChangelogs} prefix="/changelog" />
      <ContentList data={filteredChangelogs} prefix="/changelog" />
    </div>
  );
}
