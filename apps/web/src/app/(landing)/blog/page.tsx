import { getBlogPosts } from "@/content/utils";
import { defaultMetadata, ogMetadata } from "@/lib/metadata/shared-metadata";
import { twitterMetadata } from "@/lib/metadata/shared-metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { ContentCategory } from "../content-category";
import { ContentList } from "../content-list";

const TITLE = "Blog";
const DESCRIPTION = "All the latest articles and news from openstatus.";

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

export default function BlogListPage() {
  const allBlogs = getBlogPosts();
  return (
    <div className="prose dark:prose-invert max-w-none">
      <h1>Blog</h1>
      <ContentCategory data={allBlogs} prefix="/blog" />
      <p>
        Get the{" "}
        <Link href="https://www.openstatus.dev/blog/feed.xml" target="_blank">
          RSS feed
        </Link>
      </p>
      <ContentList data={allBlogs} prefix="/blog" withCategory />
    </div>
  );
}
