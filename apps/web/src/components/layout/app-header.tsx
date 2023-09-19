"use client";

import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";

import { Button, Skeleton } from "@openstatus/ui";

import { socialsConfig } from "@/config/socials";
import { Shell } from "../dashboard/shell";
import { Icons } from "../icons";

/**
 * TODO: work on a better breadcrumb navigation like Vercel
 * [workspace/project/deploymenents/deployment]
 * This will allow us to 'only' save, and not redirect the user to the other pages
 * and therefore, can after saving the monitor/page go to the next tab!
 * Probably, we will need to use useSegements() from vercel, but once done properly, it could be really nice to share
 */

export function AppHeader() {
  const { isLoaded, isSignedIn } = useUser();

  return (
    <header className="border-border sticky top-3 z-50 w-full md:top-6">
      <Shell className="bg-background/70 flex w-full items-center justify-between px-3 py-3 backdrop-blur-lg md:px-6 md:py-3">
        <Link
          href={`/${isSignedIn ? "app" : ""}`}
          className="font-cal text-muted-foreground hover:text-foreground text-lg"
        >
          OpenStatus
        </Link>
        <div className="flex items-center gap-4">
          {/* can be moved to a different place */}
          <ul className="flex gap-2">
            {socialsConfig.map(({ title, href, icon }) => {
              const Icon = Icons[icon];
              return (
                <li key={title} className="w-full">
                  <Button size="icon" variant="ghost" asChild>
                    <a href={href} target="_blank" rel="noreferrer">
                      <Icon className="h-5 w-5" />
                    </a>
                  </Button>
                </li>
              );
            })}
          </ul>
          {!isLoaded && !isSignedIn ? (
            <Skeleton className="h-8 w-8 rounded-full" />
          ) : (
            <UserButton />
          )}
        </div>
      </Shell>
    </header>
  );
}
