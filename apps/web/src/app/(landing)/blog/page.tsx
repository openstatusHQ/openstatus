import type { Metadata } from "next";
import Link from "next/link";

import { getBlogPosts } from "@/content/utils";
import { JsonLd } from "@/lib/metadata/json-ld";
import {
  BASE_URL,
  defaultMetadata,
  ogMetadata,
} from "@/lib/metadata/shared-metadata";
import { twitterMetadata } from "@/lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBreadcrumbList,
  getJsonLDItemList,
  getJsonLDOrganization,
} from "@/lib/metadata/structured-data";

import { ContentCategory } from "../content-category";
import { ContentList } from "../content-list";

const TITLE = "Blog - Engineering, Product & Monitoring Insights";
const DESCRIPTION =
  "Read engineering deep dives, product updates, and monitoring best practices from the openstatus team. Learn about uptime monitoring, incident communication, and building reliable systems.";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/blog",
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

export default function BlogListPage() {
  const allBlogs = getBlogPosts();
  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Blog", url: `${BASE_URL}/blog` },
    ]),
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
