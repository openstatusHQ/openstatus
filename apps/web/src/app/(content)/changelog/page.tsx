
import type { Metadata } from "next";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Button } from "@openstatus/ui";
import { Mdx } from "@/components/content/mdx";
import { Timeline } from "@/components/content/timeline";
import { Shell } from "@/components/dashboard/shell";
import { allChangelogs } from "contentlayer/generated";
import { ListPagination } from "../_components/list-pagination";
import { Rss } from "lucide-react";
import { z } from "zod";


export const metadata: Metadata = {
  ...defaultMetadata,
  title: "Changelog",
  openGraph: {
    ...ogMetadata,
    title: "Changelog | OpenStatus",
  },
  twitter: {
    ...twitterMetadata,
    title: "Changelog | OpenStatus",
  },
};

const SearchParamsSchema = z.object({
  page: z.string().optional().transform((val) => parseInt(val || "1", 10)),
});

export default function ChangelogClient({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined }; }) {
  const search = SearchParamsSchema.safeParse(searchParams);

  const page = search.data?.page
  const currentPage = !page ? 1 : page
  const itemsPerPage = 10;

  const sortedChangelogs = allChangelogs.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const totalPages = Math.ceil(sortedChangelogs.length / itemsPerPage);
  const paginatedChangelogs = sortedChangelogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <Shell>
      <Timeline
        title="Changelog"
        description="All the latest features, fixes and work to OpenStatus."
        actions={
          <Button variant="outline" size="icon" asChild>
            <a href="/changelog/feed.xml" target="_blank" rel="noreferrer">
              <Rss className="h-4 w-4" />
              <span className="sr-only">RSS feed</span>
            </a>
          </Button>
        }
      >
        {paginatedChangelogs.map((changelog) => (
          <Timeline.Article
            key={changelog.slug}
            publishedAt={changelog.publishedAt}
            imageSrc={changelog.image}
            title={changelog.title}
            href={`./changelog/${changelog.slug}`}
          >
            <Mdx code={changelog.body.code} />
          </Timeline.Article>
        ))}
        {currentPage && totalPages &&
          <ListPagination current={currentPage} total={totalPages} />
        }
      </Timeline>
    </Shell>
  );
}
