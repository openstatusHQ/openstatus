import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { allBlogs } from "contentlayer/generated";

import { Footer } from "@/components/layout/footer";
import { Mdx } from "@/components/Mdx";
import { Button } from "@/components/ui/button";

export async function generateStaticParams() {
  return allBlogs.map((blog) => ({
    slug: blog.slug,
  }));
}

// TODO: add OG image
export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata | undefined> {
  const blog = allBlogs.find((blog) => blog.slug === params.slug);
  if (!blog) {
    return;
  }
  const { title, publishedAt: publishedTime, description, slug } = blog;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime,
      url: `https://openstatus.dev/blog/${slug}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function BlogPage({ params }: { params: { slug: string } }) {
  const blog = allBlogs.find((blog) => blog.slug === params.slug);

  if (!blog) {
    notFound();
  }
  return (
    <>
      <article className="relative my-5 grid grid-cols-[1fr,min(90%,100%),1fr] gap-y-8 sm:grid-cols-[1fr,min(90%,100%),1fr] sm:pt-8 md:grid md:grid-cols-[1fr,min(80%,100%),1fr] lg:grid-cols-[1fr,min(70%,100%),1fr] xl:grid-cols-[1fr,minmax(auto,240px),min(50%,100%),minmax(auto,240px),1fr] xl:gap-x-5 xl:px-0 [&>*]:col-start-2 xl:[&>*]:col-start-3">
        <div>
          <Button variant="default">
            <Link href="/blog">⬅ Blogs</Link>
          </Button>
        </div>

        <section className="mt-1">
          <div className="mt-2 w-full sm:pointer-events-none xl:!col-end-5">
            <h1 className="text-3xl font-bold sm:text-4xl">{blog.title}</h1>
          </div>
          <div className="mt-2 flex flex-col items-center justify-between sm:flex-row">
            <div>
              <Link href={blog.authorLink}>{blog.author}</Link>
              <span className="text-muted-foreground">
                {" / "}
                {blog.publishedAtFormatted}
              </span>
            </div>
            <div className="text-muted-foreground text-sm sm:pointer-events-none lg:text-base">
              ~{blog.readingTime}
            </div>
          </div>
        </section>

        <main className="prose prose-p:text-sm md:prose-p:text-base prose-ul:text-sm md:prose-ul:text-base lg:prose-lg dark:prose-invert prose-code:before:content-none prose-code:after:content-none mb-6 w-full max-w-none">
          <Mdx code={blog.body.code} />
        </main>
      </article>
      <Footer />
    </>
  );
}
