import type { Metadata } from "next";

import { components } from "../../../../content/mdx";
import { categoriesIndex, sections } from "../../../../content/sections";
import { getBlogPosts } from "../../../../content/utils";
import { getListingMetadata } from "../../../../lib/metadata/shared-metadata";
import { ContentBoxLink, ContentBoxTitle } from "../../content-box";

export const metadata: Metadata = getListingMetadata(
  categoriesIndex(sections.blog),
);

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
