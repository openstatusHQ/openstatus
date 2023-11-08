import Image from "next/image";
import Link from "next/link";

import { formatDate } from "@/lib/utils";

interface TimelineProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export function Timeline({ title, description, children }: TimelineProps) {
  return (
    <div className="grid gap-8">
      <div className="grid gap-4 md:grid-cols-5 md:gap-8">
        <div className="md:col-span-1" />
        <div className="grid gap-4 md:col-span-4">
          <h1 className="text-foreground font-cal text-4xl">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

interface ArticleProps {
  href: string;
  publishedAt: string;
  imageSrc: string;
  title: string;
  children?: React.ReactNode;
}

function Article({
  publishedAt,
  imageSrc,
  title,
  children,
  href,
}: ArticleProps) {
  return (
    <article className="grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-6">
      <time className="text-muted-foreground order-2 font-mono text-sm md:order-1 md:col-span-1">
        {formatDate(new Date(publishedAt))}
      </time>
      <div className="relative order-1 h-64 w-full md:order-2 md:col-span-4">
        <Link href={href}>
          <Image
            src={imageSrc}
            fill={true}
            alt={title}
            className="border-border rounded-md border object-cover"
          />
        </Link>
      </div>
      <div className="order-3 grid grid-cols-1 gap-4 md:col-span-4 md:col-start-2">
        <h3 className="text-foreground font-cal text-2xl">{title}</h3>
        {children}
      </div>
    </article>
  );
}

Timeline.Article = Article;
