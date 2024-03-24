import { allChangelogs } from "contentlayer/generated";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Separator } from "@openstatus/ui";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { ChangelogCard } from "@/components/content/changelog";
import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";
import { Pagination } from "../../_components/pagination";

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
}): Promise<Metadata | undefined> {
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

function getChangelogPagination(slug: string) {
  const changelogs = allChangelogs.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
  const findIndex = changelogs.findIndex(
    (changelog) => changelog.slug === slug,
  );
  return {
    prev: changelogs?.[findIndex - 1],
    next: changelogs?.[findIndex + 1],
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

  const { next, prev } = getChangelogPagination(params.slug);

  return (
    <>
      <BackButton href="/changelog" />
      <Shell className="flex flex-col gap-8 sm:py-8 md:gap-12 md:py-12">
        <ChangelogCard post={post} />
        <Separator className="mx-auto max-w-prose" />
        <Pagination {...{ next, prev }} />
      </Shell>
    </>
  );
}
