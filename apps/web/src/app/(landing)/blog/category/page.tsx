import { components } from "@/content/mdx";
import { getBlogPosts } from "@/content/utils";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/lib/metadata/shared-metadata";
import type { Metadata } from "next";
import { ContentBoxLink, ContentBoxTitle } from "../../content-box";

const TITLE = "Blog Categories";
const DESCRIPTION = "Browse all blog categories from openstatus.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/blog/category",
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

export default function BlogCategoryIndex() {
  const posts = getBlogPosts();
  const categories = [...new Set(posts.map((post) => post.metadata.category))];

  return (
    <section className="prose dark:prose-invert max-w-none">
      <h1>Blog Categories</h1>
      <components.Grid cols={2}>
        {categories.map((category) => (
          <ContentBoxLink
            key={category}
            href={`/blog/category/${category.toLowerCase()}`}
          >
            <ContentBoxTitle className="capitalize">{category}</ContentBoxTitle>
          </ContentBoxLink>
        ))}
      </components.Grid>
    </section>
  );
}
