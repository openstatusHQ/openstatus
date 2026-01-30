import { ContentCategory } from "@/app/(landing)/content-category";
import { ContentList } from "@/app/(landing)/content-list";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { getChangelogPosts } from "@/content/utils";
import type { Metadata } from "next";

const TITLE = "Changelog Category";
const DESCRIPTION = "All the latest changes and updates to openstatus.";

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

  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1 className="capitalize">Changelog | {slug}</h1>
      <ContentCategory data={allChangelogs} prefix="/changelog" />
      <ContentList data={filteredChangelogs} prefix="/changelog" />
    </div>
  );
}
