"use client";

import Image from "next/image";
import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { ArrowUpRight, Slash } from "lucide-react";

import { Button, Skeleton } from "@openstatus/ui";

import { Shell } from "../dashboard/shell";
import { ChangelogViewedButton } from "../workspace/changelog-viewed-button";
import { SelectWorkspace } from "../workspace/select-workspace";
import { AppTabs } from "./header/app-tabs";

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
      <Shell className="bg-background/70 px-3 py-3 backdrop-blur-lg md:px-6 md:py-3">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center">
            <Link href="/app" className="shrink-0">
              <Image
                src="/icon.png"
                alt="OpenStatus"
                height={30}
                width={30}
                className="border-border rounded-full border"
              />
            </Link>
            <div className="text-muted-foreground ml-3 mr-1">
              <Slash className="h-4 w-4 -rotate-12" />
            </div>
            <div className="w-40">
              <SelectWorkspace />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ul className="flex gap-1">
              <li className="w-full">
                <ChangelogViewedButton />
              </li>
              <li className="w-full">
                <Button variant="link" asChild>
                  <Link href="/docs" target="_blank">
                    Docs
                    <ArrowUpRight className="ml-1 h-4 w-4 flex-shrink-0" />
                  </Link>
                </Button>
              </li>
            </ul>
            <div className="relative">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="absolute inset-0">
                {isLoaded && isSignedIn && <UserButton />}
              </div>
            </div>
          </div>
        </div>
        <div className="-mb-3">
          <AppTabs />
        </div>
      </Shell>
    </header>
  );
}
