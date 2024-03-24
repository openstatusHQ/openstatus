import type { Changelog } from "contentlayer/generated";
import Image from "next/image";

import { Mdx } from "@/components/content/mdx";
import { formatDate } from "@/lib/utils";

export function ChangelogCard({ post }: { post: Changelog }) {
  return (
    <article className="relative mx-auto flex max-w-prose flex-col gap-8">
      <div className="grid w-full gap-3">
        <p className="text-muted-foreground font-mono text-sm">
          {formatDate(new Date(post.publishedAt))}
        </p>
        <h1 className="font-cal mb-5 text-3xl">{post.title}</h1>
        <div className="border-border relative h-64 w-full overflow-hidden rounded-lg border">
          <Image
            src={post.image}
            fill={true}
            alt={post.title}
            className="object-cover"
          />
        </div>
      </div>
      <Mdx code={post.body.code} />
    </article>
  );
}
