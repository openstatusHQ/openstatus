import { CustomMDX } from "@/content/mdx";
import { getComparePages } from "@/content/utils";
import { BASE_URL, getPageMetadata } from "@/lib/metadata/shared-metadata";
import {
  createJsonLDGraph,
  getJsonLDBlogPosting,
  getJsonLDBreadcrumbList,
  getJsonLDFAQPage,
  getJsonLDHowTo,
  getJsonLDOrganization,
  getJsonLDWebPage,
} from "@/lib/metadata/structured-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const { slug } = await params;
  const post = getComparePages().find((post) => post.slug === slug);

  if (!post) {
    return;
  }

  const metadata = getPageMetadata(post, "compare");

  return metadata;
}

export async function generateStaticParams() {
  const posts = getComparePages();

  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export default async function Blog({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getComparePages().find((post) => post.slug === slug);

  if (!post) {
    notFound();
  }

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDWebPage(post),
    getJsonLDBlogPosting(post, "compare"),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Compare", url: `${BASE_URL}/compare` },
      { name: post.metadata.title, url: `${BASE_URL}/compare/${slug}` },
    ]),
    getJsonLDHowTo(post),
    getJsonLDFAQPage(post),
  ]);

  return (
    <section className="prose dark:prose-invert max-w-none">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: jsonLd
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLDGraph).replace(/</g, "\\u003c"),
        }}
      />
      <h1>{post.metadata.title}</h1>
      <p className="text-lg">{post.metadata.description}</p>
      <CustomMDX source={post.content} />
    </section>
  );
}
