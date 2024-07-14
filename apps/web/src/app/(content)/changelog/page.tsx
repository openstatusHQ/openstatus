
import type { Metadata } from "next";
import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Shell } from "@/components/dashboard/shell";
import { Button } from "@openstatus/ui";
import { Mdx } from "@/components/content/mdx";
import { Timeline } from "@/components/content/timeline";
import { allChangelogs } from "contentlayer/generated";
import { Context } from "vm";
import ListPagination from "../_components/ListPagination";


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

export default function ChangelogClient(context: Context) {
  const currentPage = parseInt(context.searchParams.page) || 1
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
              <span className="h-4 w-4">RSS</span>
              <span className="sr-only">RSS feed</span>
            </a>
          </Button>
        }
      >
        <ListPagination current={currentPage} total={totalPages} />
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
        <ListPagination current={currentPage} total={totalPages} />
      </Timeline>
    </Shell>
  );
}
