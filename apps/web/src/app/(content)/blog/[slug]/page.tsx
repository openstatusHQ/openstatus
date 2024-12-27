import { allPosts } from "content-collections";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Article } from "@/components/content/article";
import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";

// export const dynamic = "force-static";

export async function generateStaticParams() {
  return allPosts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata | undefined> {
  const params = await props.params;
  const post = allPosts.find((post) => post.slug === params.slug);
  if (!post) {
    return;
  }
  const { title, publishedAt, description, slug, image } = post;

  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);
  const encodedImage = encodeURIComponent(image);

  return {
    ...defaultMetadata,
    title,
    description,
    openGraph: {
      ...ogMetadata,
      title,
      description,
      type: "article",
      publishedTime: publishedAt.toISOString(),
      url: `https://www.openstatus.dev/blog/${slug}`,
      images: [
        {
          url: `https://openstatus.dev/api/og/post?title=${encodedTitle}&image=${encodedImage}&description=${encodedDescription}`,
        },
      ],
    },
    twitter: {
      ...twitterMetadata,
      title,
      description,
      images: [
        `https://openstatus.dev/api/og/post?title=${encodedTitle}&image=${encodedImage}&description=${encodedDescription}`,
      ],
    },
  };
}

export default async function PostPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const params = await props.params;
  const post = allPosts.find((post) => post.slug === params.slug);

  if (!post) notFound();

  return (
    <>
      <BackButton href="/blog" />
      <Shell className="sm:py-8 md:py-12">
        <Article post={post} />
      </Shell>
    </>
  );
}
