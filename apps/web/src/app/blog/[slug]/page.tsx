import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allPosts } from "contentlayer/generated";

import { Mdx } from "@/components/content/mdx";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-static";

export async function generateStaticParams() {
  return allPosts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata | void> {
  const post = allPosts.find((post) => post.slug === params.slug);
  if (!post) {
    return;
  }
  const { title, publishedAt: publishedTime, description, slug } = post;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime,
      url: `https://www.openstatus.dev/blog/${slug}`,
      images: [
        {
          url: `https://www.openstatus.dev/api/og?title=${title}&description=${description}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        `https://www.openstatus.dev/api/og?title=${title}&description=${description}`,
      ],
    },
  };
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = allPosts.find((post) => post.slug === params.slug);

  if (!post) {
    notFound();
  }

  // TODO: add author.avatar and author.url
  return (
    <article className="grid gap-8">
      <div className="mx-auto grid max-w-prose gap-3">
        <h1 className="font-cal text-3xl">{post.title}</h1>
        <p className="text-muted-foreground text-sm font-light">
          {post.author.name}
          <span className="text-muted-foreground/70 mx-1">&bull;</span>
          {formatDate(new Date(post.publishedAt))}
          <span className="text-muted-foreground/70 mx-1">&bull;</span>
          {post.readingTime}
        </p>
      </div>
      <div className="mx-auto max-w-prose">
        <Mdx code={post.body.code} />
      </div>
    </article>
  );
}
