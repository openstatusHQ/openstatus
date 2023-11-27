import Image from "next/image";
import Link from "next/link";
import type { Post } from "contentlayer/generated";

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
        <h1 className="font-cal mb-5 text-3xl">{post.title}</h1>
        <div className="border-border relative h-64 w-full overflow-hidden rounded-lg border">
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
          <div className="text-muted-foreground text-sm font-light">
            <Link
              href={post.author.url ?? "#"}
              target="_blank"
              className="text-foreground cursor-pointer font-medium hover:underline"
            >
              {post.author.name}
            </Link>
            <p>
              {formatDate(new Date(post.publishedAt))}
              <span className="text-muted-foreground/70 mx-1">&bull;</span>
              {post.readingTime}
            </p>
          </div>
        </div>
      </div>
      <Mdx code={post.body.code} />
    </article>
  );
}
