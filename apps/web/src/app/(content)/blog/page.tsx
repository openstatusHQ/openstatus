
import { allPosts } from "contentlayer/generated";
import { Rss } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@openstatus/ui";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Timeline } from "@/components/content/timeline";
import { Shell } from "@/components/dashboard/shell";
import { ListPagination } from "../_components/list-pagination";
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

const SearchParamsSchema = z.object({
  page: z.string().optional().transform((val) => parseInt(val || "1", 10)),
});

export default function Post({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined }; }) {
  const search = SearchParamsSchema.safeParse(searchParams);

  const page = search.data?.page
  const currentPage = !page ? 1 : page
  const itemsPerPage = 10;

  const sortedPosts = allPosts.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const totalPages = Math.ceil(sortedPosts.length / itemsPerPage);
  const paginatedPosts = sortedPosts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
        {paginatedPosts.map((post) => (
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
        {currentPage && totalPages &&
          <ListPagination current={currentPage} total={totalPages} />
        }
      </Timeline>
    </Shell>
  );
}
