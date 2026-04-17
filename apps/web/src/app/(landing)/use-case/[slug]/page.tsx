import { CustomMDX } from "@/content/mdx";
import { getUseCasePages } from "@/content/utils";
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
import Image from "next/image";
import { notFound } from "next/navigation";
import { ContentMetadata } from "../../content-metadata";
import { ContentPagination } from "../../content-pagination";

export const dynamicParams = false;

export async function generateStaticParams() {
  const posts = getUseCasePages();

  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const { slug } = await params;
  const post = getUseCasePages().find((post) => post.slug === slug);
  if (!post) {
    return;
  }

  const metadata = getPageMetadata(post, "use-case");

  return metadata;
}

export default async function UseCase({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const posts = getUseCasePages().sort(
    (a, b) =>
      b.metadata.publishedAt.getTime() - a.metadata.publishedAt.getTime(),
  );
  const postIndex = posts.findIndex((post) => post.slug === slug);
  const post = posts[postIndex];
  const previousPost = posts[postIndex - 1];
  const nextPost = posts[postIndex + 1];

  if (!post) {
    notFound();
  }

  const jsonLDGraph = createJsonLDGraph([
    getJsonLDOrganization(),
    getJsonLDWebPage(post),
    getJsonLDBlogPosting(post, "use-case"),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Use Cases", url: `${BASE_URL}/use-case` },
      { name: post.metadata.title, url: `${BASE_URL}/use-case/${slug}` },
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
      <ContentMetadata data={post} />
      {post.metadata.image ? (
        <div className="relative aspect-video w-full overflow-hidden border border-border">
          <Image
            src={post.metadata.image}
            alt={post.metadata.title}
            fill
            className="object-contain"
          />
        </div>
      ) : null}
      <CustomMDX source={post.content} />
      <ContentPagination
        previousPost={previousPost}
        nextPost={nextPost}
        prefix="/use-case"
      />
    </section>
  );
}
