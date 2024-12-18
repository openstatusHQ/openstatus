import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Mdx } from "@/components/content/mdx";
import { Timeline } from "@/components/content/timeline";
import { Shell } from "@/components/dashboard/shell";
import {
  Button,
  Pagination,
  PaginationContent,
  PaginationLink,
} from "@openstatus/ui";
import { allChangelogs } from "content-collections";
import { Rss } from "lucide-react";
import type { Metadata } from "next";
import {
  ITEMS_PER_PAGE,
  MAX_PAGE_INDEX,
  searchParamsCache,
} from "./search-params";

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

export default async function ChangelogClient(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const { pageIndex } = searchParamsCache.parse(searchParams);

  const changelogs = allChangelogs
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice(pageIndex * ITEMS_PER_PAGE, (pageIndex + 1) * ITEMS_PER_PAGE);

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
        {changelogs.map((changelog) => (
          <Timeline.Article
            key={changelog.slug}
            publishedAt={changelog.publishedAt}
            imageSrc={changelog.image}
            title={changelog.title}
            href={`./changelog/${changelog.slug}`}
          >
            <Mdx code={changelog.mdx} />
          </Timeline.Article>
        ))}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-6">
          <div className="row-span-2" />
          <div className="w-full md:order-2 md:col-span-4">
            <Pagination>
              <PaginationContent>
                {Array.from({ length: MAX_PAGE_INDEX + 1 }).map((_, index) => {
                  return (
                    <PaginationLink
                      // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                      key={index}
                      href={`?pageIndex=${index}`}
                      isActive={pageIndex === index}
                    >
                      {index + 1}
                    </PaginationLink>
                  );
                })}
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </Timeline>
    </Shell>
  );
}
