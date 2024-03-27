"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { Button, Skeleton } from "@openstatus/ui";

import { Shell } from "@/components/dashboard/shell";
import { ChangelogViewedButton } from "@/components/workspace/changelog-viewed-button";
import { AppTabs } from "./app-tabs";
import { Breadcrumbs } from "./breadcrumbs";

export function AppHeader() {
  const { isLoaded, isSignedIn } = useUser();
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
        <AppTabs />
      </Shell>
    </header>
  );
}
