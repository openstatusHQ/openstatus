"use client";

import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";

import { Shell } from "../dashboard/shell";
import { Skeleton } from "../ui/skeleton";

export function AppHeader() {
  const { isLoaded, isSignedIn } = useUser();

  return (
    <header className="border-border sticky top-3 z-50 w-full">
      <Shell className="bg-background/70 flex w-full items-center justify-between px-3 py-3 backdrop-blur-lg md:px-6 md:py-3">
        <Link
          href="/app"
          className="font-cal text-muted-foreground hover:text-foreground text-lg"
        >
          openstatus
        </Link>
        {!isLoaded && !isSignedIn ? (
          <Skeleton className="h-8 w-8 rounded-full" />
        ) : (
          <UserButton />
        )}
      </Shell>
    </header>
  );
}
