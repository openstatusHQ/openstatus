import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { allPosts } from "contentlayer/generated";

import { Mdx } from "@/components/content/mdx";
import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";
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
  const { title, publishedAt: publishedTime, description, slug, image } = post;

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
          url: `https://openstatus.dev/api/og/post?title=${title}&description=${description}&image=${image}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        `https://openstatus.dev/api/og/post?title=${title}&description=${description}&image=${image}`,
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
    <>
      <BackButton href="/blog" />
      <Shell className="sm:py-8 md:py-12">
        <article className="grid gap-8">
          <div className="mx-auto grid w-full max-w-prose gap-3">
            <h1 className="font-cal mb-5 text-3xl">{post.title}</h1>
            <div className="border-border relative h-64 w-full overflow-hidden rounded-lg border">
              {/* <Image
                src={post.image}
                fill={true}
                alt={post.title}
                className="object-cover"
              /> */}
              {/* HOTFIX: plain `img` */}
              <img
                src={post.image}
                alt={post.title}
                className="h-full w-full object-cover"
              />
            </div>
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
      </Shell>
    </>
  );
}
