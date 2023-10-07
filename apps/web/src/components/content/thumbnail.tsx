import Link from "next/link";
import type { Post } from "contentlayer/generated";

import { formatDate } from "@/lib/utils";

export function Thumbnail({ post }: { post: Post }) {
  return (
    <div key={post.slug}>
      <Link href={`/blog/${post.slug}`}>
        <section>
          <p className="text-foreground font-cal text-2xl">{post.title}</p>
          <p className="text-muted-foreground">{post.description}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {post.author.name}
            <span className="text-muted-foreground/70 mx-1">&bull;</span>
            {formatDate(new Date(post.publishedAt))}
            <span className="text-muted-foreground/70 mx-1">&bull;</span>
            {post.readingTime}
          </p>
        </section>
      </Link>
    </div>
  );
}
