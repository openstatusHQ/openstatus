import Image from "next/image";
import { allChangelogs } from "contentlayer/generated";

import { Mdx } from "@/components/content/mdx";
import { Shell } from "@/components/dashboard/shell";
import { formatDate } from "@/lib/utils";

/**
 * TODO: add generateMetadata and use the last post for the description
 */

export default async function Changelog() {
  const posts = allChangelogs.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return (
    <Shell>
      <div className="grid gap-8">
        <div className="grid gap-4 md:grid-cols-5 md:gap-8">
          <div className="md:col-span-1" />
          <div className="grid gap-4 md:col-span-4">
            <h1 className="text-foreground font-cal text-4xl">Changelog</h1>
            <p className="text-muted-foreground">
              All the latest features, fixes and work to OpenStatus.
            </p>
          </div>
        </div>
        {posts.map((post) => (
          <article
            key={post.slug}
            className="grid gap-4 md:grid-cols-5 md:gap-6"
          >
            <time className="text-muted-foreground order-2 font-mono text-sm md:order-1 md:col-span-1">
              {formatDate(new Date(post.publishedAt))}
            </time>
            <div className="relative order-1 h-64 w-full md:order-2 md:col-span-4">
              <Image
                src={post.image}
                fill={true}
                alt={post.title}
                className="border-border rounded-md border object-cover"
              />
            </div>
            <h3 className="text-foreground font-cal order-3 text-2xl md:col-span-4 md:col-start-2">
              {post.title}
            </h3>
            <div className="order-4 md:col-span-4 md:col-start-2">
              <Mdx code={post.body.code} />
            </div>
          </article>
        ))}
      </div>
    </Shell>
  );
}
