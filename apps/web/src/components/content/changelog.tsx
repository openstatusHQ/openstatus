import Image from "next/image";
import type { Changelog } from "contentlayer/generated";

import { Mdx } from "@/components/content/mdx";
import { formatDate } from "@/lib/utils";

export function Changelog({ post }: { post: Changelog }) {
  return (
    <article className="grid gap-8">
      <div className="mx-auto grid w-full max-w-prose gap-3">
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
      <div className="prose-pre:overflow-y-auto prose-pre:max-w-xs md:prose-pre:max-w-none mx-auto max-w-prose">
        <Mdx code={post.body.code} />
      </div>
    </article>
  );
}
