import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allPosts } from "contentlayer/generated";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Mdx } from "@/components/content/mdx";
import { Shell } from "@/components/dashboard/shell";
import { BackButton } from "@/components/layout/back-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
    ...defaultMetadata,
    title,
    description,
    openGraph: {
      ...ogMetadata,
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
      ...twitterMetadata,
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

  const getNameInitials = (name: string) => {
    const individualNames = name.split(" ");
    return (
      individualNames[0][0] + individualNames[individualNames.length - 1][0]
    );
  };

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
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarImage src={post.author.avatar} />
                <AvatarFallback>
                  {getNameInitials(post.author.name)}
                </AvatarFallback>
              </Avatar>
              <p className="text-muted-foreground text-sm font-light">
                <Link
                  href={post.author.url ?? "#"}
                  target="_blank"
                  className="cursor-pointer font-medium text-black hover:underline"
                >
                  {post.author.name}
                </Link>
                <div>
                  {formatDate(new Date(post.publishedAt))}
                  <span className="text-muted-foreground/70 mx-1">&bull;</span>
                  {post.readingTime}
                </div>
              </p>
            </div>
          </div>
          <div className="mx-auto max-w-prose">
            <Mdx code={post.body.code} />
          </div>
        </article>
      </Shell>
    </>
  );
}
