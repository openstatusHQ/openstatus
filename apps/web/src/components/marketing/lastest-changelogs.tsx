import { allChangelogs } from "contentlayer/generated";
import Link from "next/link";

import { Button } from "@openstatus/ui";

import { formatDate } from "@/lib/utils";
import {
  CardContainer,
  CardDescription,
  CardHeader,
  CardIcon,
  CardTitle,
} from "./card";

export function LatestChangelogs() {
  const latestChangelogs = allChangelogs
    .sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1))
    .slice(0, 4);

  return (
    <CardContainer>
      <CardHeader>
        <CardIcon icon="zap" />
        <CardTitle>We ship</CardTitle>
        <CardDescription>
          Check out the changelog to see our latest features.
        </CardDescription>
      </CardHeader>
      <ul className="mx-auto w-full max-w-xs">
        {latestChangelogs.map((changelog) => (
          <li
            key={changelog.slug}
            className="border-accent group relative grid gap-2 border-l-2 px-4 py-2"
          >
            <Link href={`/changelog/${changelog.slug}`}>
              <div className="bg-border group-hover:bg-muted-foreground absolute -left-1.5 top-4 h-2.5 w-2.5 rounded-full" />
              <p className="text-muted-foreground">
                {formatDate(new Date(changelog.publishedAt))}
              </p>
              <p className="line-clamp-1 text-lg font-medium">
                {changelog.title}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex justify-center">
        <Button className="rounded-full" asChild>
          <Link href="/changelog">Full changelog</Link>
        </Button>
      </div>
    </CardContainer>
  );
}
