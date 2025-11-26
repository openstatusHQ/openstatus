import type { Post } from "content-collections";
import Image from "next/image";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage, Badge } from "@openstatus/ui";

import { Mdx } from "@/components/content/mdx";
import { formatDate } from "@/lib/utils";

function getAuthor(post: Post) {
  if (post.author.name.includes("Maximilian")) {
    return {
      name: "Maximilian Kaske",
      url: "https://mxkaske.dev",
      image: "h/assets/authors/max.png",
    };
  }
  if (post.author.name.includes("Thibault")) {
    return {
      name: "Thibault Le Ouay Ducasse",
      url: "https://thibaultleouay.dev",
      image: "h/assets/authors/thibault.jpeg",
    };
  }
  return {
    name: "openstatus",
    url: "https://openstatus.dev",
    image: "https://www.openstatus.dev/assets/logos/OpenStatus-Logo.svg",
  };
}

export function Article({ post }: { post: Post }) {
  const getNameInitials = (name: string) => {
    const individualNames = name.split(" ");
    return (
      individualNames[0][0] + individualNames[individualNames.length - 1][0]
    );
  };

  const author = getAuthor(post);

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
            <AvatarImage src={author.image} />
            <AvatarFallback>{getNameInitials(author.name)}</AvatarFallback>
          </Avatar>
          <div className="font-light text-muted-foreground text-sm">
            <Link
              href={author.url ?? "#"}
              target="_blank"
              className="cursor-pointer font-medium text-foreground hover:underline"
            >
              {author.name}
            </Link>
            <div className="flex flex-wrap items-center gap-1.5">
              <time className="font-mono">{formatDate(post.publishedAt)}</time>
              <span className="text-muted-foreground/70">&bull;</span>
              <span className="font-mono">{post.readingTime}</span>
              <span className="text-muted-foreground/70">&bull;</span>
              <Badge variant="outline" className="font-normal capitalize">
                {post.tag}
              </Badge>
            </div>
          </div>
        </div>
      </div>
      <Mdx code={post.mdx} />
    </article>
  );
}
