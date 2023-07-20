import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allPosts } from "contentlayer/generated";

import { BackButton } from "@/components/layout/back-button";
import { Footer } from "@/components/layout/footer";
import { Mdx } from "@/components/mdx";

export async function generateStaticParams() {
  return allPosts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata | undefined> {
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
      url: `https://openstatus.dev/blog/${slug}`,
      images: [
        {
          url: `https://openstatus.dev/api/og?title=${title}&description=${description}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        `https://openstatus.dev/api/og?title=${title}&description=${description}`,
      ],
    },
  };
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = allPosts.find((post) => post.slug === params.slug);

  if (!post) {
    notFound();
  }
  return (
    <>
      <article className="relative my-5 grid grid-cols-[1fr,min(90%,100%),1fr] gap-y-8 sm:grid-cols-[1fr,min(90%,100%),1fr] sm:pt-8 md:grid md:grid-cols-[1fr,min(80%,100%),1fr] lg:grid-cols-[1fr,min(70%,100%),1fr] xl:grid-cols-[1fr,minmax(auto,240px),min(50%,100%),minmax(auto,240px),1fr] xl:gap-x-5 xl:px-0 [&>*]:col-start-2 xl:[&>*]:col-start-3">
        <div>
          <BackButton />
        </div>

        <section className="mt-1">
          <div className="mt-2 w-full sm:pointer-events-none xl:!col-end-5">
            <h1 className="text-3xl font-bold sm:text-4xl">{post.title}</h1>
          </div>
          <div className="mt-2 flex flex-col items-center justify-between sm:flex-row">
            <div>
              <Link href={post.authorLink}>{post.author}</Link>
              <span className="text-muted-foreground">
                {" / "}
                {post.publishedAtFormatted}
              </span>
            </div>
            <div className="text-muted-foreground text-sm sm:pointer-events-none lg:text-base">
              ~{post.readingTime}
            </div>
          </div>
        </section>

        {/* load Post content stored in .mdx format */}
        <Mdx code={post.body.code} />
      </article>
      <Footer />
    </>
  );
}
