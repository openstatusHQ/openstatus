import { ContentCategory } from "@/app/(landing)/content-category";
import { ContentList } from "@/app/(landing)/content-list";
import { getGuides } from "@/content/utils";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import type { Metadata } from "next";

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

  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1 className="capitalize">Guides | {slug}</h1>
      <ContentCategory data={allGuides} prefix="/guides" />
      <ContentList data={filteredGuides} prefix="/guides" />
    </div>
  );
}
