import { BASE_URL, getPageMetadata } from "@/app/shared-metadata";
import { CustomMDX } from "@/content/mdx";
import { formatDate, getBlogPosts } from "@/content/utils";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

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

  const metadata = getPageMetadata(post);

  return metadata;
}

export default async function Blog({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getBlogPosts().find((post) => post.slug === slug);

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
              ? `${BASE_URL}${post.metadata.image}`
              : `/api/og?title=${encodeURIComponent(
                  post.metadata.title
                )}&description=${encodeURIComponent(
                  post.metadata.description
                )}&category=${encodeURIComponent(post.metadata.category)}`,
            url: `${BASE_URL}/blog/${post.slug}`,
            author: {
              "@type": "Person",
              name: "Maximilian Kaske",
            },
          }),
        }}
      />
      <h1>{post.metadata.title}</h1>
      <p className="flex items-center gap-2.5 divide-x divide-border text-muted-foreground">
        {formatDate(post.metadata.publishedAt)} | by {post.metadata.author} | [
        {post.metadata.category}]
      </p>
      <CustomMDX source={post.content} />
    </section>
  );
}
