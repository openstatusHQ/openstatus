import type { Metadata } from "next";
import { allChangelogs } from "contentlayer/generated";
import { Rss } from "lucide-react";

import { Button } from "@openstatus/ui";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Mdx } from "@/components/content/mdx";
import { Timeline } from "@/components/content/timeline";
import { Shell } from "@/components/dashboard/shell";

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

export default async function Changelog() {
  const changelogs = allChangelogs.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return (
    <Shell>
      <Timeline
        title="Changelog"
        description="All the latest features, fixes and work to OpenStatus."
        actions={
          <Button variant="outline" size="icon" asChild>
            <a href="/changelog/feed.xml" target="_blank">
              <Rss className="h-4 w-4" />
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
            <Mdx code={changelog.body.code} />
          </Timeline.Article>
        ))}
      </Timeline>
    </Shell>
  );
}
