import { ContentCategory } from "@/app/(landing)/content-category";
import { ContentList } from "@/app/(landing)/content-list";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { getBlogPosts } from "@/content/utils";
import type { Metadata } from "next";

const TITLE = "Blog Category";
const DESCRIPTION = "All the latest articles and news from OpenStatus.";

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

  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1 className="capitalize">Blog | {slug}</h1>
      <ContentCategory data={allBlogs} prefix="/blog" />
      <ContentList data={filteredBlogs} prefix="/blog" />
    </div>
  );
}
