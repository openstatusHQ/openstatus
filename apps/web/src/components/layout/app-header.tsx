"use client";

import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";

import { Skeleton } from "../ui/skeleton";

export function AppHeader() {
  const { isLoaded, isSignedIn } = useUser();

  return (
    // use `h-8` to avoid header layout shift on load
    <header className="z-10 flex h-8 w-full items-center justify-between">
      <Link
        href="/"
        className="font-cal text-muted-foreground hover:text-foreground text-lg"
      >
        openstatus
      </Link>
      {!isLoaded && !isSignedIn ? (
        <Skeleton className="h-8 w-8 rounded-full" />
      ) : (
        <UserButton />
      )}
    </header>
  );
}
