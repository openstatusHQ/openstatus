import type { Post } from "content-collections";
import Image from "next/image";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@openstatus/ui";

import { Mdx } from "@/components/content/mdx";
import { formatDate } from "@/lib/utils";

export function Article({ post }: { post: Post }) {
  const getNameInitials = (name: string) => {
    const individualNames = name.split(" ");
    return (
      individualNames[0][0] + individualNames[individualNames.length - 1][0]
    );
  };

  return (
    <article className="relative mx-auto flex max-w-prose flex-col gap-8">
      <div className="grid w-full gap-3">
        <h1 className="mb-5 font-cal text-3xl">{post.title}</h1>
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border">
          <Image
            src={post.image}
            fill={true}
            alt={post.title}
            className="object-cover"
          />
        </div>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={post.author.avatar} />
            <AvatarFallback>{getNameInitials(post.author.name)}</AvatarFallback>
          </Avatar>
          <div className="font-light text-muted-foreground text-sm">
            <Link
              href={post.author.url ?? "#"}
              target="_blank"
              className="cursor-pointer font-medium text-foreground hover:underline"
            >
              {post.author.name}
            </Link>
            <p>
              {formatDate(post.publishedAt)}
              <span className="mx-1 text-muted-foreground/70">&bull;</span>
              {post.readingTime}
            </p>
          </div>
        </div>
      </div>
      <Mdx code={post.mdx} />
    </article>
  );
}
