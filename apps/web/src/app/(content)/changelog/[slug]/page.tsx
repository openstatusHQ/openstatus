import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allChangelogs } from "contentlayer/generated";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Changelog } from "@/components/content/changelog";
import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";

// export const dynamic = "force-static";

export async function generateStaticParams() {
  return allChangelogs.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata | void> {
  const post = allChangelogs.find((post) => post.slug === params.slug);
  if (!post) {
    return;
  }

  const { title, publishedAt: publishedTime, description, slug, image } = post;

  return {
    ...defaultMetadata,
    title,
    description,
    openGraph: {
      ...ogMetadata,
      title,
      description,
      type: "article",
      publishedTime,
      url: `https://www.openstatus.dev/changelog/${slug}`,
      images: [
        {
          url: `https://openstatus.dev/api/og/post?title=${title}&description=${description}&image=${image}`,
        },
      ],
    },
    twitter: {
      ...twitterMetadata,
      title,
      description,
      images: [
        `https://openstatus.dev/api/og/post?title=${title}&description=${description}&image=${image}`,
      ],
    },
  };
}

export default function ChangelogPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = allChangelogs.find((post) => post.slug === params.slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <BackButton href="/changelog" />
      <Shell className="sm:py-8 md:py-12">
        <Changelog post={post} />
      </Shell>
    </>
  );
}
