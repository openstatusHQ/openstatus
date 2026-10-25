import type { Metadata } from "next";
import Link from "next/link";

import { sections } from "../../../content/sections";
import { getBlogPosts } from "../../../content/utils";
import { JsonLd } from "../../../lib/metadata/json-ld";
import { getListingMetadata } from "../../../lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDItemList,
  getJsonLDOrganization,
  getJsonLDSectionBreadcrumb,
} from "../../../lib/metadata/structured-data";
import { ContentCategory } from "../content-category";
import { ContentList } from "../content-list";

export const metadata: Metadata = getListingMetadata(sections.blog);

export default function BlogListPage() {
  const allBlogs = getBlogPosts();
  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDSectionBreadcrumb(sections.blog),
    getJsonLDItemList(allBlogs, "/blog"),
  ]);
  return (
    <div className="prose dark:prose-invert max-w-none">
      <JsonLd graph={jsonLDGraph} />
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
