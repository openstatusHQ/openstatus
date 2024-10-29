"use client";

import { allChangelogs } from "content-collections";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Button, Skeleton } from "@openstatus/ui";

import { Shell } from "@/components/dashboard/shell";
import { useCookieState } from "@/hooks/use-cookie-state";
import { AppTabs } from "./app-tabs";
import { Breadcrumbs } from "./breadcrumbs";
import { UserNav } from "./user-nav";

const lastChangelog = allChangelogs
  .sort(
    (a, b) =>
      new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  )
  .pop();

export function AppHeader() {
  const [lastViewed, setLastViewed] = useCookieState(
    "last-viewed-changelog",
    new Date(0).toISOString(),
  );

  const show =
    lastChangelog && lastViewed
      ? new Date(lastViewed) < new Date(lastChangelog.publishedAt)
      : false;

  return (
    // TODO: discuss amount of top-3 and top-6
    <header className="sticky top-2 z-50 w-full border-border">
      <Shell className="bg-background/70 px-3 py-3 backdrop-blur-lg md:px-6 md:py-3">
        <div className="flex w-full items-center justify-between">
          <Breadcrumbs />
          {/*  */}
          <div className="flex items-center gap-1">
            <ul className="hidden gap-1 sm:flex">
              <li className="w-full">
                <Button variant="link" asChild>
                  <Link
                    href="/changelog"
                    target="_blank"
                    onClick={() => setLastViewed(new Date().toISOString())}
                    className="relative"
                  >
                    Changelog
                    {show ? (
                      <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500" />
                    ) : null}
                  </Link>
                </Button>
              </li>
              <li className="w-full">
                <Button variant="link" asChild>
                  <Link href="/docs" target="_blank" className="group">
                    Docs
                    <ArrowUpRight className="ml-1 h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
                  </Link>
                </Button>
              </li>
            </ul>
            <div className="relative">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="absolute inset-0">
                <UserNav />
              </div>
            </div>
          </div>
        </div>
        <AppTabs />
      </Shell>
    </header>
  );
}
