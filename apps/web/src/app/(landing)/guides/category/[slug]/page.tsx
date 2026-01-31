import { ContentCategory } from "@/app/(landing)/content-category";
import { ContentList } from "@/app/(landing)/content-list";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { getGuides } from "@/content/utils";
import type { Metadata } from "next";

const TITLE = "Guide Category";
const DESCRIPTION = "All the latest guides from openstatus.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
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
