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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@openstatus/ui";
import Link from "next/link";

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
      <Breadcrumb className="mb-4 px-3 md:px-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/blog">Blog</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{post.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Shell className="sm:py-8 md:py-12">
        <Article post={post} />
      </Shell>
    </>
  );
}
