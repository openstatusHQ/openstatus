import { CustomMDX } from "@/content/mdx";
import { formatDate, getBlogPosts } from "@/content/utils";
import { getAuthor } from "@/data/author";
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
import { ContentPagination } from "../../content-pagination";

export const dynamicParams = false;

export async function generateStaticParams() {
  const posts = getBlogPosts();

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
  const post = getBlogPosts().find((post) => post.slug === slug);
  if (!post) {
    return;
  }

  const metadata = getPageMetadata(post, "blog");

  return metadata;
}

export default async function Blog({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const posts = getBlogPosts().sort(
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
    getJsonLDBlogPosting(post, "blog"),
    getJsonLDBreadcrumbList([
      { name: "Home", url: BASE_URL },
      { name: "Blog", url: `${BASE_URL}/blog` },
      { name: post.metadata.title, url: `${BASE_URL}/blog/${slug}` },
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
      <p className="flex items-center gap-2.5 divide-x divide-border text-muted-foreground">
        {formatDate(post.metadata.publishedAt)} | by{" "}
        <Author author={post.metadata.author} /> | [{post.metadata.category}]
      </p>
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
        prefix="/blog"
      />
    </section>
  );
}

function Author({ author }: { author: string }) {
  const authorData = getAuthor(author);
  if (typeof authorData === "string") {
    return author;
  }

  return (
    <a href={authorData.url} target="_blank" rel="noopener noreferrer">
      {authorData.name}
    </a>
  );
}
