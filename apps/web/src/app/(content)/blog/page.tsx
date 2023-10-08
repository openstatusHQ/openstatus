import type { Metadata } from "next";
import Link from "next/link";
import { allPosts } from "contentlayer/generated";

import { Button } from "@openstatus/ui";

import {
  defaultMetadata,
  ogMetadata,
  twitterMetadata,
} from "@/app/shared-metadata";
import { Timeline } from "@/components/content/timeline";
import { Shell } from "@/components/dashboard/shell";

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

export default async function Post() {
  const posts = allPosts.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return (
    <Shell>
      <Timeline
        title="Blog"
        description="All the latest articles and news from OpenStatus."
      >
        {posts.map((post) => (
          <Timeline.Article
            key={post.slug}
            publishedAt={post.publishedAt}
            imageSrc={post.image}
            title={post.title}
          >
            <div className="prose">
              <p>{post.description}</p>
            </div>
            <div>
              <Button variant="outline" className="rounded-full" asChild>
                <Link href={`./blog/${post.slug}`}>Read more</Link>
              </Button>
            </div>
          </Timeline.Article>
        ))}
      </Timeline>
    </Shell>
  );
}
