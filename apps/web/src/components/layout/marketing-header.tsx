"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@openstatus/ui";

import { cn } from "@/lib/utils";
import { BrandName } from "./brand-name";
import { MarketingMenu } from "./marketing-menu";

interface Props {
  className?: string;
}

export function MarketingHeader({ className }: Props) {
  const { isSignedIn } = useUser();

  return (
    <header
      className={cn("grid w-full grid-cols-2 gap-2 md:grid-cols-5", className)}
    >
      <div className="flex items-center md:col-span-1">
        <BrandName />
      </div>
      <div className="hidden items-center justify-center md:col-span-3 md:flex md:gap-3">
        <Button variant="link" asChild className="md:mr-3">
          <Link href="/blog">Blog</Link>
        </Button>
        <Button variant="link" asChild className="md:mr-3">
          <Link href="/changelog">Changelog</Link>
        </Button>
        <Button variant="link" asChild className="md:mr-3">
          <Link href="https://docs.openstatus.dev" target="_blank">
            Docs
            <ArrowUpRight className="ml-1 h-4 w-4 flex-shrink-0" />
          </Link>
        </Button>
      </div>
      <div className="flex items-center justify-end gap-3 md:col-span-1">
        <div className="block md:hidden">
          <MarketingMenu />
        </div>
        <Button asChild className="rounded-full">
          {isSignedIn ? (
            <Link href="/app">Dashboard</Link>
          ) : (
            <Link href="/app/sign-up">Sign Up</Link>
          )}
        </Button>
      </div>
    </header>
  );
}
