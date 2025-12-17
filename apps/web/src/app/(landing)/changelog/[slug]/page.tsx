import { getPageMetadata } from "@/app/shared-metadata";
import { CustomMDX } from "@/content/mdx";
import { formatDate, getChangelogPosts } from "@/content/utils";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ContentPagination } from "../../content-pagination";

const baseUrl = "http://localhost:3000";

export async function generateStaticParams() {
  const posts = getChangelogPosts();

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
  const post = getChangelogPosts().find((post) => post.slug === slug);
  if (!post) {
    return;
  }

  const metadata = getPageMetadata(post);

  return metadata;
}

export default async function Changelog({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const posts = getChangelogPosts().sort(
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

  return (
    <section className="prose dark:prose-invert max-w-none">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.metadata.title,
            datePublished: post.metadata.publishedAt,
            dateModified: post.metadata.publishedAt,
            description: post.metadata.description,
            image: post.metadata.image
              ? `${baseUrl}${post.metadata.image}`
              : `/api/og?title=${encodeURIComponent(
                  post.metadata.title,
                )}&description=${encodeURIComponent(
                  post.metadata.description,
                )}&category=${encodeURIComponent(post.metadata.category)}`,
            url: `${baseUrl}/changelog/${post.slug}`,
            author: {
              "@type": "Person",
              name: post.metadata.author,
            },
          }),
        }}
      />
      <h1>{post.metadata.title}</h1>
      <p className="flex items-center gap-2.5 divide-x divide-border text-muted-foreground">
        {formatDate(post.metadata.publishedAt)} | by {post.metadata.author} | [
        {post.metadata.category}]
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
        prefix="/changelog"
      />
    </section>
  );
}
