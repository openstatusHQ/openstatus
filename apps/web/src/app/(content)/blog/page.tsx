import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Timeline } from "@/components/content/timeline";
import { Shell } from "@/components/dashboard/shell";
import {
  Button,
  Pagination,
  PaginationContent,
  PaginationLink,
} from "@openstatus/ui";
import { allPosts } from "contentlayer/generated";
import { Rss } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

export const metadata: Metadata = {
  ...defaultMetadata,
  title: "Blog",
  openGraph: {
    ...ogMetadata,
    title: "Blog | OpenStatus",
  },
  twitter: {
    ...twitterMetadata,
    title: "Blog | OpenStatus",
  },
};

const searchParamsSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => Number.parseInt(val || "1", 10)),
});

const ITEMS_PER_PAGE = 10;

export default function Post({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const search = searchParamsSchema.safeParse(searchParams);

  const page = search.data?.page;
  const current = !page ? 1 : page;
  const total = Math.ceil(allPosts.length / ITEMS_PER_PAGE);

  const posts = allPosts
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice((current - 1) * ITEMS_PER_PAGE, current * ITEMS_PER_PAGE);

  return (
    <Shell>
      <Timeline
        title="Blog"
        description="All the latest articles and news from OpenStatus."
        actions={
          <Button variant="outline" size="icon" asChild>
            <a href="/blog/feed.xml" target="_blank" rel="noreferrer">
              <Rss className="h-4 w-4" />
              <span className="sr-only">RSS feed</span>
            </a>
          </Button>
        }
      >
        {posts.map((post) => (
          <Timeline.Article
            key={post.slug}
            publishedAt={post.publishedAt}
            imageSrc={post.image}
            title={post.title}
            href={`./blog/${post.slug}`}
          >
            <div className="prose dark:prose-invert">
              <p>{post.description}</p>
            </div>
            <div>
              <Button variant="outline" className="rounded-full" asChild>
                <Link href={`./blog/${post.slug}`}>Read more</Link>
              </Button>
            </div>
          </Timeline.Article>
        ))}
        {current && total && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-6">
            <div className="row-span-2" />
            <div className="w-full md:order-2 md:col-span-4">
              <Pagination>
                <PaginationContent>
                  {Array.from({ length: total }).map((_, index) => {
                    return (
                      <PaginationLink
                        href={`?page=${index + 1}`}
                        isActive={current === index + 1}
                      >
                        {index + 1}
                      </PaginationLink>
                    );
                  })}
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        )}
      </Timeline>
    </Shell>
  );
}
